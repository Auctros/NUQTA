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
const srcFiles = walk(join(root, 'src')).map((p) => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
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
  const stripped = idx.replace(/<!--[\s\S]*?-->/g, '');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(stripped);
  if (!csp) hits.push('index.html has no Content-Security-Policy');

  // Everything outside the CSP line must stay origin-free: no <script>, <link> or
  // <img> may point at another host.
  const withoutCsp = stripped.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
  if (/https?:\/\/(?!www\.w3\.org)/.test(withoutCsp)) {
    hits.push('index.html references an external URL outside the CSP');
  }

  // The CSP itself is reviewed, not blanket-permitted. The one accepted exception is
  // YouTube thumbnails for imported courses: images only, exactly one host. Keeping
  // the allow-list explicit means a future edit cannot quietly widen it.
  const allow = /img-src([^;]*)/.exec(csp?.[1] ?? '')?.[1] ?? '';
  const externalImgHosts = [...allow.matchAll(/https?:\/\/([^\s;'"]+)/g)].map((m) => m[1]);
  const unreviewedHosts = externalImgHosts.filter((host) => host !== 'i.ytimg.com');
  if (unreviewedHosts.length) {
    hits.push(`img-src allows an unreviewed host: ${unreviewedHosts.join(', ')}`);
  }
  // A thumbnail host must never be reachable from script or XHR.
  for (const directive of ['script-src', 'connect-src', 'default-src']) {
    const value = new RegExp(`${directive}([^;]*)`).exec(csp?.[1] ?? '')?.[1] ?? '';
    if (/https?:\/\//.test(value)) hits.push(`${directive} allows an external origin`);
  }

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
  const serverFiles = [
    join(root, 'scripts/serve-dist.mjs'),
    join(root, 'scripts/sync-server.mjs'),
    ...(existsSync(join(root, 'scripts/sync'))
      ? readdirSync(join(root, 'scripts/sync'))
          .filter((name) => name.endsWith('.mjs'))
          .map((name) => join(root, 'scripts/sync', name))
      : []),
  ]
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, 'utf8'));
  const haystack =
    srcFiles.map((f) => f.text).join('\n') +
    readFileSync(join(root, 'index.html'), 'utf8') +
    readFileSync(join(root, 'vite.config.ts'), 'utf8') +
    serverFiles.join('\n');
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
  // Deleting caches must be scoped to NUQTA-owned names, never "delete everything".
  // A deletion is safe if it targets the current CACHE, or a variable produced by a
  // filter over the NUQTA prefix (e.g. `keys.filter(k => k.startsWith(CACHE_PREFIX))`).
  if (!/startsWith\(CACHE_PREFIX\)/.test(sw)) {
    fail(
      'Service worker does not scope cache deletion to the NUQTA prefix',
      'expected a filter using startsWith(CACHE_PREFIX) before any caches.delete()'
    );
  }
  const scopedVars = new Set(['CACHE']);
  for (const m of sw.matchAll(/\.filter\(\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>[^;{]*startsWith\(CACHE_PREFIX\)/g)) {
    scopedVars.add(m[1]);
  }
  const deleteArgs = [...sw.matchAll(/caches\.delete\(\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  if (deleteArgs.length === 0) {
    fail('Service worker never prunes obsolete caches', 'expected a guarded caches.delete() call');
  }
  const unsafe = deleteArgs.filter((arg) => !scopedVars.has(arg));
  if (unsafe.length) {
    fail(
      'Service worker may delete caches that are not NUQTA-owned',
      `caches.delete(${unsafe.join('), caches.delete(')}) is not scoped by a NUQTA-prefix filter`
    );
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
// 14. Network/telemetry primitives are confined to ONE reviewed module.
//     Nuqta is local-first: the only component allowed to touch the network is the
//     sync client, and only to talk to the user's own sync endpoint.
//
//     This scan matches direct AND indirect spellings, because a scan that only looked
//     for `fetch(` would pass `globalThis.fetch(...)` and `globalThis['WebSocket']`
//     while the app still made requests. That false assurance is the bug this rule
//     previously had: the sync client reached both primitives through `globalThis`,
//     so the rule reported "clean" for code that opens sockets.
//
//     The YouTube course client is the second and only other such module: it talks to
//     this app's OWN origin (`/api/youtube/*`), which proxies to YouTube server-side so
//     no API key ever reaches the browser. It is listed explicitly, reviewed by hand,
//     and must never be widened to an arbitrary third-party URL.
//
//     What it guarantees: outside `NETWORK_MODULES`, no fetch/WebSocket/XHR/beacon/
//     EventSource/geolocation primitive appears in first-party `.ts`/`.tsx` source,
//     whether written directly or reached through `globalThis`/`window`/`self`, and
//     whether called as a method or indexed as a string.
//     What it CANNOT guarantee: it does not scan index.html, public/, scripts/, tests/,
//     CSS url() references, bundled output, or third-party dependencies; and it cannot
//     see a URL handed to an <img>/<a>/<script> src or a request made inside a
//     dependency. The allow-listed module is reviewed by hand instead.
{
  const NETWORK_MODULES = new Set(['src/lib/sync/client.ts', 'src/lib/youtubeClient.ts']);

  // `fetch(` / `.fetch(` / `globalThis.fetch` / `globalThis["fetch"]` all match, as do
  // bare references passed around (e.g. `const f = globalThis.fetch`).
  const patterns = [
    /(?<![.\w$])fetch\s*\(/,
    /\.fetch\s*\(/,
    /(?<![.\w$])fetch\s*[,)]/,
    /['"`]fetch['"`]/,
    /XMLHttpRequest/,
    /navigator\.sendBeacon/,
    // Whole word, so `globalThis.WebSocket`, `(x as any).WebSocket` and
    // `['WebSocket']` all match — a preceding `.` must not hide the primitive.
    /\bWebSocket\b/,
    /EventSource/,
    /navigator\.geolocation/
  ];

  const hits = [];
  for (const file of srcFiles) {
    if (NETWORK_MODULES.has(file.path)) continue;
    const lines = file.text.split('\n');
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      if (patterns.some((re) => re.test(line))) {
        hits.push(`${file.path}:${i + 1}: ${line.trim()}`);
      }
    });
  }

  if (hits.length) {
    fail(
      `Network/telemetry primitive outside the reviewed network modules (${[...NETWORK_MODULES].join(', ')})`,
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

// 20. The service worker must be registered with `updateViaCache: 'none'` and the page
//     must guard against reload loops. GitHub Pages serves sw.js with `max-age=600`; if
//     the browser is allowed to HTTP-cache the worker script, a new deploy can go
//     unnoticed for ten minutes — the exact "no visible change" failure. And an unguarded
//     `controllerchange` reload is how a PWA ends up in a reload loop.
{
  const pwa = readFileSync(join(root, 'src/lib/pwaUpdate.ts'), 'utf8');
  if (!/updateViaCache\s*:\s*['"]none['"]/.test(pwa)) {
    fail(
      "Service worker must be registered with { updateViaCache: 'none' }",
      'src/lib/pwaUpdate.ts registers the worker without it, so sw.js can be served from the HTTP cache'
    );
  }
  if (!/controllerchange/.test(pwa) || !/reloading/.test(pwa)) {
    fail(
      'The controllerchange reload must be guarded against loops',
      'src/lib/pwaUpdate.ts is missing the controllerchange guard'
    );
  }
  const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');
  if (!/startPwaUpdates/.test(main)) {
    fail(
      'The PWA update lifecycle is not started at boot',
      'src/main.tsx must call startPwaUpdates()'
    );
  }
}

// 21. Multi-tab safety. skipWaiting() is global: it activates the new worker for every
//     client, so a reload triggered by one tab's update would discard another tab's work.
//     Hiding a tab must therefore never apply an update, and a reload may only follow the
//     tab's OWN apply() call. Removing either guard silently reintroduces the multi-tab
//     data-loss bug.
{
  const pwa = readFileSync(join(root, 'src/lib/pwaUpdate.ts'), 'utf8');
  if (!/expectsReload/.test(pwa)) {
    fail(
      'Only the tab that applied the update may reload',
      'src/lib/pwaUpdate.ts is missing the expectsReload guard, so a controllerchange caused by another tab could reload this one'
    );
  }
  if (!/requestApplyLock/.test(pwa)) {
    fail(
      'Applying an update must be serialized across tabs',
      'src/lib/pwaUpdate.ts must elect a single tab (Web Locks) to post skipWaiting'
    );
  }
  // The hide branch of handleVisibility must return without applying. Guard against a
  // future edit that reintroduces auto-apply on hide.
  if (/handleVisibility[\s\S]{0,400}?\bisHidden\(\)[\s\S]{0,120}?apply\(\)/.test(pwa)) {
    fail(
      'Hiding a tab must never apply an update',
      'src/lib/pwaUpdate.ts applies an update from the hidden branch of handleVisibility'
    );
  }
  const sw = readFileSync(join(root, 'public/sw.js'), 'utf8');
  if (!/nuqta-claim-cleanup/.test(sw)) {
    fail(
      'Old caches must be reclaimed only on an explicit cleanup message',
      'public/sw.js must delete obsolete caches on nuqta-claim-cleanup, not during activate'
    );
  }
  // A reloaded tab does not prove every other tab migrated, so cleanup must retain the
  // previous version's cache rather than deleting every older cache.
  if (!/RETAINED_PREVIOUS_VERSIONS/.test(sw) || !/slice\(\s*RETAINED_PREVIOUS_VERSIONS\s*\)/.test(sw)) {
    fail(
      'Cleanup must retain the previous version cache (bounded retention)',
      'public/sw.js must keep RETAINED_PREVIOUS_VERSIONS caches instead of deleting all older ones'
    );
  }
}

// 22. Every exercise must render the one shared illustration set. The library used to
//     hand-draw each movement (and, briefly, ship a separate écorché reference); both
//     made the library look like unrelated clip-art. One authored character set is what
//     makes the figures consistent, so the registry must map every catalog key to art
//     that is actually vendored, and nothing may reintroduce the old renderers.
{
  const art = readFileSync(join(root, 'src/components/workout/illustration/exerciseArt.ts'), 'utf8');
  const catalogFiles = ['src/lib/catalog/upperBody.ts', 'src/lib/catalog/lowerBody.ts'];
  const keys = new Set();
  for (const file of catalogFiles) {
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(/illustrationKey:\s*'([^']+)'/g)) keys.add(m[1]);
  }
  const missing = [...keys].filter((k) => !new RegExp(`'${k}':\\s*\\{`).test(art));
  if (missing.length) {
    fail(
      'Every catalog exercise must resolve to shared art',
      `illustration/exerciseArt.ts is missing: ${missing.join(', ')}`
    );
  }
  const manifest = JSON.parse(readFileSync(join(root, 'public/exercise-art/manifest.json'), 'utf8'));
  const vendored = new Set(Object.keys(manifest.art || {}));
  const absent = [...new Set([...art.matchAll(/art:\s*'([^']+)'/g)].map((m) => m[1]))].filter((id) => !vendored.has(id));
  if (absent.length) {
    fail(
      'Illustration keys must point at vendored artwork',
      `public/exercise-art is missing: ${absent.join(', ')}`
    );
  }
  if (!/CC-BY-SA-4\.0/.test(art) || !/Open-Exercise-Art/.test(art)) {
    fail(
      'The illustration set must stay attributed',
      'illustration/exerciseArt.ts must credit Open Exercise Art under CC BY-SA 4.0'
    );
  }
  // The removed renderers must not creep back in beside the shared set.
  for (const dead of ['EcorcheFigure', 'StudioAnatomy', 'illustration/registry', 'illustration/poses']) {
    const hit = [...walk(join(root, 'src'))].find((f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, 'utf8').includes(dead));
    if (hit) {
      fail(
        'The library renders one shared illustration set',
        `${hit} still references "${dead}"; the per-exercise/procedural art was replaced by exerciseArt.ts`
      );
    }
  }
}

// 23. Notifications are local-only. Read/dismissed state is per-device, and the sync
//     server rejects stores outside its allow-list, so a notification key in the sync map
//     would silently break sync rather than sync notifications.
{
  const storage = readFileSync(join(root, 'src/lib/storage.ts'), 'utf8');
  const syncMap = /SYNC_SECTION_KEYS[^{]*\{([\s\S]*?)\n\};/.exec(storage);
  if (syncMap && /NOTIFICATIONS/.test(syncMap[1])) {
    fail(
      'Notifications must never be synchronized',
      'STORAGE_KEYS.NOTIFICATIONS appears in SYNC_SECTION_KEYS; notification read state is local-only'
    );
  }
  // Comments legitimately mention React/storage when explaining why they are avoided, so
  // only executable lines count.
  const impure = grep(/localStorage|indexedDB|\bReact\b|window\./, {
    except: []
  }).filter((hit) => hit.startsWith('src/lib/notificationEngine.ts'));
  if (impure.length) {
    fail(
      'The notification engine must stay pure',
      impure.join('\n    ')
    );
  }
}

// 24. No browser-native dialogs. window.alert / confirm / prompt render outside the app
//     shell: they ignore the theme, the language and RTL, block the main thread, and look
//     like a different product. Every prompt must go through the interaction layer
//     (src/components/ui/dialogController.ts), which is styled, localized and testable.
{
  const hits = grep(/(?<![\w.$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/, {
    // The controller defines the API under those names; nothing else may call them.
    except: ['src/components/ui/dialogController.ts']
  }).filter((hit) => !/dialogs\.(?:alert|confirm|prompt)\(/.test(hit));
  if (hits.length) {
    fail(
      'Browser-native dialogs are forbidden — use dialogs.confirm/alert/prompt from ./ui',
      hits.slice(0, 8).join('\n    ')
    );
  }
}

if (failures.length) {
  console.error(`\nInvariant check FAILED (${failures.length}):\n\n${failures.join('\n\n')}\n`);
  process.exit(1);
}
console.log('Invariant check passed (24 rules).');
