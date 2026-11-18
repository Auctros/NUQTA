#!/usr/bin/env node
/**
 * Acceptance gate: project-wide rules that unit tests cannot express.
 * Run by `npm run verify` after lint, tests and build. Exits non-zero on any violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = (rule, detail) => failures.push(`✗ ${rule}\n    ${detail}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const srcFiles = walk(join(root, 'src')).map((p) => ({ path: relative(root, p), text: readFileSync(p, 'utf8') }));
const isComment = (line) => /^\s*(\*|\/\/|\/\*)/.test(line);
const grep = (re, { except = [] } = {}) =>
  srcFiles.flatMap((f) =>
    except.includes(f.path)
      ? []
      : f.text
          .split('\n')
          .flatMap((line, i) => (!isComment(line) && re.test(line) ? [`${f.path}:${i + 1}: ${line.trim()}`] : []))
  );

// 1. Calendar days must be LOCAL, never UTC.
{
  const hits = grep(/toISOString\(\)\s*\.(split|slice|substring)\(/);
  if (hits.length) fail('Date keys must use localDateKey(), not toISOString().split/slice (UTC off-by-one)', hits.slice(0, 5).join('\n    '));
}
// 2. Never wipe the whole origin's localStorage.
{
  const hits = grep(/localStorage\.clear\(/);
  if (hits.length) fail('localStorage.clear() is forbidden; wipe only nuqta_ keys via NuqtaStorageEngine.wipeAll()', hits.join('\n    '));
}
// 3. Sample data is opt-in: only the storage engine may import it.
{
  const hits = grep(/from\s+['"].*demoData['"]/, { except: ['src/lib/storage.ts'] });
  if (hits.length) fail('demoData may only be imported by src/lib/storage.ts (opt-in loadDemoData)', hits.join('\n    '));
}
// 4. No fabricated personal defaults.
{
  const hits = grep(/name:\s*['"]Tariq['"]|weightKg:\s*73\.2|sleepHours:\s*7\.5/, { except: ['src/lib/demoData.ts'] });
  if (hits.length) fail('Invented personal data found in source', hits.join('\n    '));
}
// 5. Weak ids.
{
  const hits = grep(/Math\.random\(\)\.toString\(/);
  if (hits.length) fail('Use crypto.randomUUID() for ids', hits.join('\n    '));
}
// 6. No unreviewed third-party network resources.
{
  const hits = grep(/fonts\.googleapis|fonts\.gstatic|images\.unsplash/);
  const idx = readFileSync(join(root, 'index.html'), 'utf8');
  if (/https?:\/\/(?!www\.w3\.org)/.test(idx.replace(/<!--[\s\S]*?-->/g, ''))) hits.push('index.html references an external URL (CSP included)');
  if (!/http-equiv="Content-Security-Policy"/.test(idx)) hits.push('index.html has no Content-Security-Policy');
  if (hits.length) fail('No third-party requests: fonts and images must be self-hosted', hits.join('\n    '));
}
// 7. Do not claim encryption that the app does not perform.
{
  const encryptionIsWired = srcFiles.some(
    (f) => f.path !== 'src/lib/crypto.ts' && /encryptPayload|decryptPayload/.test(f.text)
  );
  if (!encryptionIsWired) {
    const hits = grep(/مشفر|Encrypted Store|end-to-end encrypt|AES.{0,20}encrypted at rest/i);
    if (hits.length) fail('UI claims encryption but nothing calls src/lib/crypto.ts', hits.join('\n    '));
  }
}
// 8. Every runtime dependency is actually used.
{
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const haystack = srcFiles.map((f) => f.text).join('\n') + readFileSync(join(root, 'index.html'), 'utf8') + readFileSync(join(root, 'vite.config.ts'), 'utf8');
  const unused = Object.keys(pkg.dependencies || {}).filter((d) => !new RegExp(`['"]${d.replace(/[/@]/g, (c) => '\\' + c)}(['"/])`).test(haystack));
  if (unused.length) fail('Unused runtime dependencies', unused.join(', '));
}
// 9. One lockfile only.
{
  const locks = ['package-lock.json', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml'].filter((f) => existsSync(join(root, f)));
  if (locks.length !== 1) fail('Exactly one lockfile expected', `found: ${locks.join(', ') || 'none'}`);
}
// 10. Production build ships the offline shell.
{
  for (const f of ['dist/index.html', 'dist/sw.js', 'dist/manifest.webmanifest']) {
    if (!existsSync(join(root, f))) fail('Build output is missing an offline-shell file', f);
  }
}
// 11. The offline acceptance test is part of the mandatory gate / CI.
{
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['test:e2e']) {
    fail('The browser-level offline test is not wired into the gate', 'package.json has no "test:e2e" script');
  }
  const workflowPath = join(root, '.github/workflows/verify.yml');
  if (!existsSync(workflowPath)) {
    fail('No CI workflow runs the acceptance gate', '.github/workflows/verify.yml is missing');
  } else {
    const workflow = readFileSync(workflowPath, 'utf8');
    if (!/test:e2e|run-offline|offline\.py/.test(workflow)) {
      fail('CI does not run the browser-level offline test', 'verify.yml never invokes test:e2e / offline.py');
    }
  }
}
// 12. The service worker only deletes its own caches and never caches dynamic requests.
{
  const sw = readFileSync(join(root, 'public/sw.js'), 'utf8');
  if (!/CACHE_VERSION/.test(sw) || !/nuqta-shell-/.test(sw)) {
    fail('The service worker cache is not versioned under a NUQTA-owned name', 'expected a nuqta-shell- prefix and a CACHE_VERSION');
  }
  // Deleting caches must be guarded by the NUQTA prefix, never by "delete everything".
  const deleteLines = sw.split('\n').filter((l) => /caches\.delete\(/.test(l));
  if (deleteLines.length === 0) {
    fail('Service worker never prunes obsolete caches', 'expected a guarded caches.delete() call');
  }
  if (!deleteLines.every((l) => /startsWith\(|CACHE\b/.test(l))) {
    fail('Service worker may delete caches that are not NUQTA-owned', deleteLines.join('\n    '));
  }
}

// 13. The app must survive a render crash instead of white-screening.
{
  const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');
  if (!/ErrorBoundary/.test(main)) {
    fail('App is not wrapped in an ErrorBoundary', 'a render error would leave a blank page with no way to export data');
  }
  if (!existsSync(join(root, 'src/components/ErrorBoundary.tsx'))) {
    fail('ErrorBoundary component is missing', 'expected src/components/ErrorBoundary.tsx');
  }
}
// 14. No obvious network/telemetry primitives in the application source.
//     This is a *textual* scan of non-comment lines in every .ts/.tsx file under src/.
//     It flags six literal patterns: fetch(, XMLHttpRequest, navigator.sendBeacon,
//     new WebSocket, new EventSource, navigator.geolocation.
//     What it guarantees: none of those six primitives appear in the scanned source.
//     What it CANNOT guarantee: it does not scan index.html, public/, scripts/, tests/,
//     CSS url() references, bundled/minified output, or third-party dependencies; and it
//     cannot see network activity reached indirectly — dynamic import(), a URL assigned
//     to an <img>/<a>/<script> src, navigator.serviceWorker.register, a same-origin
//     relative path, or a request made from a dependency. It proves the absence of the
//     listed primitives in first-party source, not the absence of all network access.
{
  const hits = grep(/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource|navigator\.geolocation/);
  if (hits.length) {
    fail(
      'Network/telemetry primitive found in scanned source (fetch/XHR/sendBeacon/WebSocket/EventSource/geolocation)',
      hits.slice(0, 5).join('\n    ')
    );
  }
}

// 15. Theme consistency: no hardcoded colour literals inside className strings.
//     Arbitrary-value utilities like `bg-[#141e19]` or `text-[#edf2f4]` freeze a
//     surface to one theme and are the exact regression this gate prevents: a
//     component stays dark while light mode is active. Colours must come from the
//     semantic tokens (var(--surface-*), var(--text-*), var(--tone-*), var(--heat-*)).
//     Inline `style={{ background: '#…' }}` is deliberately NOT scanned — user data
//     (book covers, artwork colours) legitimately stores raw hexes.
{
  const hits = [];
  const classAttr = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g;
  for (const f of srcFiles) {
    let m;
    classAttr.lastIndex = 0;
    while ((m = classAttr.exec(f.text))) {
      const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      const hex = value.match(/#[0-9a-fA-F]{3,8}\b/);
      if (hex) {
        const line = f.text.slice(0, m.index).split('\n').length;
        hits.push(`${f.path}:${line}: ${hex[0]}`);
      }
    }
  }
  if (hits.length) {
    fail(
      'Hardcoded colour in className (breaks light/dark) — use a semantic token instead',
      hits.slice(0, 8).join('\n    ')
    );
  }
}

// 16. The NUQTA week has one definition. Weekday reads must go through src/lib/week.ts
//     (the only module allowed to call Date.getDay()); an inline `getDay()` comparison at
//     a call site is how the old Sunday-first behaviour silently drifted from Saturday-first.
{
  const hits = grep(/\.getDay\(\)/, { except: ['src/lib/week.ts'] });
  if (hits.length) {
    fail(
      'Weekday read outside src/lib/week.ts — use dayOfWeek()/indexFromWeekStart() from the week module',
      hits.slice(0, 8).join('\n    ')
    );
  }
}

// 17. The window scrollbar must never reflow the layout. The app scrolls on <html>,
//     so a classic OS scrollbar that appears on some pages but not others changes the
//     content width and makes navigation feel like switching apps. The root must reserve
//     the gutter (scrollbar-gutter: stable) and paint the rail in the app palette.
{
  const css = readFileSync(join(root, 'src/index.css'), 'utf8');
  const htmlRule = css.match(/(^|\n)html\s*\{([^}]*)\}/);
  const body = htmlRule ? htmlRule[2] : '';
  if (!/scrollbar-gutter\s*:\s*stable/.test(body)) {
    fail(
      'Root scrollbar must reserve its space — add `scrollbar-gutter: stable` to the `html { … }` rule',
      'src/index.css'
    );
  }
  if (!/scrollbar-color\s*:/.test(body)) {
    fail('Root scrollbar must be themed — add `scrollbar-color` to the `html { … }` rule', 'src/index.css');
  }
}

// 18. Date and time are chosen with the branded pickers, never the native controls.
//     NuqtaDatePicker / NuqtaTimePicker keep the native value contract ("YYYY-MM-DD" local
//     day / "HH:mm") while matching NuqtaSelect's design, theming and RTL. A stray
//     <input type="date|time|datetime-local"> silently reverts to the OS widget and drifts
//     from the kit — the exact regression this rule prevents.
{
  const hits = grep(/type\s*=\s*["'](?:date|time|datetime-local)["']/);
  if (hits.length) {
    fail(
      'Native date/time input found — use NuqtaDatePicker / NuqtaTimePicker from ./ui',
      hits.slice(0, 8).join('\n    ')
    );
  }
}

// 19. Modals must not be trapped by a transformed ancestor. `.page-content` wraps every
//     view, and both the legacy `.modal-backdrop` and the kit `Modal`/`Sheet` are
//     `position: fixed` inside it. A `transform` on `.page-content` — including one an
//     entry animation leaves applied forever via fill-mode — makes it the containing block
//     for those fixed overlays, so they size to the whole (tall) page instead of the
//     viewport and the browser scrolls to the misplaced dialog. Keep the page-entry
//     animation to opacity only.
{
  const css =
    readFileSync(join(root, 'src/nuqta-theme.css'), 'utf8') + '\n' + readFileSync(join(root, 'src/index.css'), 'utf8');
  const problems = [];
  const rule = css.match(/\.page-content\s*\{([^}]*)\}/);
  const body = rule ? rule[1] : '';
  if (/(^|;)\s*transform\s*:/.test(body)) problems.push('.page-content sets `transform` directly');
  const anim = body.match(/animation\s*:\s*([^;}]+)/);
  if (anim) {
    const name = anim[1].trim().split(/\s+/)[0];
    const kfStart = css.indexOf('@keyframes ' + name);
    if (kfStart !== -1) {
      const open = css.indexOf('{', kfStart);
      let depth = 0;
      let end = -1;
      for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const kfBody = css.slice(open + 1, end === -1 ? undefined : end);
      if (/transform\s*:/.test(kfBody)) {
        problems.push(`the page-entry animation "${name}" animates \`transform\``);
      }
    }
  }
  if (problems.length) {
    fail(
      'A transformed .page-content traps position:fixed modals inside the page (they open off-screen)',
      problems.join('\n    ')
    );
  }
}

if (failures.length) {
  console.error(`\nInvariant check FAILED (${failures.length}):\n\n${failures.join('\n\n')}\n`);
  process.exit(1);
}
console.log('Invariant check passed (19 rules).');
