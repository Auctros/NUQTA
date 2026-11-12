#!/usr/bin/env node
/**
 * Mandatory browser-level acceptance gate for the offline shell.
 *
 * Builds the production bundle, serves it with `vite preview`, waits for the port to
 * answer, then runs scripts/e2e/offline.py (Playwright) against it and exits with the
 * test's own exit code. Cross-platform: no shell, no POSIX-only commands.
 *
 *   node scripts/e2e/run-offline.mjs
 *
 * Requires Playwright for Python: pip install playwright && playwright install chromium
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.OFFLINE_PORT || '4173';
const URL = `http://localhost:${PORT}/`;
const isWindows = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

// 1. Build the production bundle (the gate must test what actually ships).
const buildStatus = run(isWindows ? 'npm.cmd' : 'npm', ['run', 'build']);
if (buildStatus !== 0) {
  console.error('offline gate: build failed');
  process.exit(buildStatus);
}

// 2. Start the preview server.
const viteBin = join('node_modules', '.bin', isWindows ? 'vite.cmd' : 'vite');
if (!existsSync(viteBin)) {
  console.error(`offline gate: vite binary not found at ${viteBin}; run npm ci first`);
  process.exit(1);
}
const server = spawn(viteBin, ['preview', '--port', PORT], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(d));

const shutdown = () => {
  if (!server.killed) server.kill();
};
process.on('exit', shutdown);
process.on('SIGINT', () => (shutdown(), process.exit(130)));

// 3. Wait for the server to answer.
async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  return false;
}

if (!(await waitForServer())) {
  console.error(`offline gate: preview server did not answer at ${URL}`);
  shutdown();
  process.exit(1);
}

// 4. Run the Playwright test; locate a Python interpreter that has Playwright.
const candidates = isWindows ? ['python', 'py', 'python3'] : ['python3', 'python'];
let python = null;
for (const c of candidates) {
  const probe = spawnSync(c, ['-c', 'import playwright'], { stdio: 'ignore' });
  if (probe.status === 0) {
    python = c;
    break;
  }
}
if (!python) {
  console.error('offline gate: no Python interpreter with Playwright found (pip install playwright)');
  shutdown();
  process.exit(1);
}

const testStatus = run(python, [join('scripts', 'e2e', 'offline.py')], { env: { ...process.env, OFFLINE_URL: URL } });
shutdown();
process.exit(testStatus);
