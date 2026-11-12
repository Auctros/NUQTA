#!/usr/bin/env node
/**
 * Cross-platform clean script for NUQTA.
 * Removes only the Vite production build output directory (`dist`).
 * Works on Windows and Unix-like systems without shell-specific commands.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');

try {
  rmSync(distDir, { recursive: true, force: true });
} catch (e) {
  console.error(`Failed to clean ${distDir}:`, e);
  process.exit(1);
}
