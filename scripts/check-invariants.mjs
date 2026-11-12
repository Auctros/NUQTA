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

if (failures.length) {
  console.error(`\nInvariant check FAILED (${failures.length}):\n\n${failures.join('\n\n')}\n`);
  process.exit(1);
}
console.log('Invariant check passed (12 rules).');
