#!/usr/bin/env node
/**
 * Cross-platform clean: removes only the generated production build output.
 * Uses Node's fs.rmSync so it behaves identically on Windows and Unix-like systems
 * (the previous `rm -rf dist` is not available in a Windows shell).
 * Scope is intentionally limited to build artifacts: no source, data or dependencies.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const targets = ['dist'];

for (const target of targets) {
  rmSync(join(process.cwd(), target), { recursive: true, force: true });
}

console.log(`Removed build output: ${targets.join(', ')}`);
