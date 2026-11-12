import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The clean script must remove ONLY the generated build output, on any platform, without
 * a shell. This executes the real scripts/clean.mjs in a throwaway directory tree and
 * checks exactly what survives.
 */

const SCRIPT = join(process.cwd(), 'scripts', 'clean.mjs');
let sandbox: string;

const seed = () => {
  // Build output that MUST be removed.
  mkdirSync(join(sandbox, 'dist', 'assets'), { recursive: true });
  writeFileSync(join(sandbox, 'dist', 'index.html'), '<html></html>');
  writeFileSync(join(sandbox, 'dist', 'assets', 'index-abc.js'), 'console.log(1)');
  // Everything below MUST survive.
  mkdirSync(join(sandbox, 'src', 'lib'), { recursive: true });
  writeFileSync(join(sandbox, 'src', 'lib', 'storage.ts'), 'export const x = 1;');
  mkdirSync(join(sandbox, 'node_modules', 'left-pad'), { recursive: true });
  writeFileSync(join(sandbox, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;');
  writeFileSync(join(sandbox, 'package.json'), '{"name":"x"}');
  writeFileSync(join(sandbox, 'package-lock.json'), '{}');
  mkdirSync(join(sandbox, 'public'), { recursive: true });
  writeFileSync(join(sandbox, 'public', 'sw.js'), '// sw');
  // A user-data-ish file and a similarly named directory that must NOT be touched.
  writeFileSync(join(sandbox, 'nuqta-backup.json'), '{"data":true}');
  mkdirSync(join(sandbox, 'dist-backup'), { recursive: true });
  writeFileSync(join(sandbox, 'dist-backup', 'keep.txt'), 'keep');
};

const run = () => execFileSync(process.execPath, [SCRIPT], { cwd: sandbox, encoding: 'utf8' });

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'nuqta-clean-'));
  seed();
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('clean script removes only the build output', () => {
  it('deletes dist and nothing else', () => {
    const out = run();
    expect(out).toContain('Removed build output: dist');
    expect(existsSync(join(sandbox, 'dist'))).toBe(false);
  });

  it('leaves source, dependencies, config, public assets and user data untouched', () => {
    run();
    for (const survivor of [
      'src/lib/storage.ts',
      'node_modules/left-pad/index.js',
      'package.json',
      'package-lock.json',
      'public/sw.js',
      'nuqta-backup.json',
      'dist-backup/keep.txt'
    ]) {
      expect(existsSync(join(sandbox, survivor)), `expected ${survivor} to survive`).toBe(true);
    }
    expect(readFileSync(join(sandbox, 'nuqta-backup.json'), 'utf8')).toBe('{"data":true}');
  });

  it('is idempotent and succeeds when dist is already absent', () => {
    run();
    expect(() => run()).not.toThrow();
    expect(existsSync(join(sandbox, 'dist'))).toBe(false);
  });

  it('uses no shell-specific commands (portable across Windows and Unix)', () => {
    const source = readFileSync(SCRIPT, 'utf8');
    // Check executable code only: the doc comment may legitimately mention `rm -rf`.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/from 'node:fs'/);
    expect(code).toMatch(/rmSync\(/);
    // No shelling out to rm/rmdir/del or spawn/exec.
    expect(code).not.toMatch(/\brm\s+-rf\b|\brmdir\b|\bdel\s+\/|execSync|spawnSync|child_process/);
  });
});
