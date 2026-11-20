import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveModuleDir() {
  if (import.meta.dirname) return import.meta.dirname;
  if (import.meta.url && import.meta.url.startsWith('file:')) {
    return dirname(fileURLToPath(import.meta.url));
  }
  return join(process.cwd(), 'scripts', 'sync');
}

const MODULE_DIR = resolveModuleDir();
export const REPO_ROOT = resolve(MODULE_DIR, '..', '..');
export const SCHEMA_PATH = join(MODULE_DIR, 'schema.sql');

export const LOCALHOST_BIND = '127.0.0.1';
export const DEFAULT_PORT = 3000;
export const DEFAULT_MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB
export const DEFAULT_MAX_PAYLOAD_SIZE = 32 * 1024; // 32 KB per change payload
export const DEFAULT_MAX_BATCH_SIZE = 100;
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 5000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function parseCsvList(value) {
  if (!value) return [];
  if (Array.isArray(value) || value instanceof Set) {
    return [...value].map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigins(rawOrigins) {
  const result = new Set();
  for (const entry of parseCsvList(rawOrigins)) {
    try {
      const parsed = new URL(entry);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        result.add(parsed.origin);
      }
    } catch {
      // Ignore invalid origin strings; fail closed if none remain valid.
    }
  }
  return result;
}

function normalizeUsers(rawUsers) {
  const result = new Set();
  for (const entry of parseCsvList(rawUsers)) {
    const normalized = entry.toLowerCase();
    if (normalized) result.add(normalized);
  }
  return result;
}

function isPathInside(parentDir, targetPath) {
  const normalizedParent = resolve(parentDir);
  const normalizedTarget = resolve(targetPath);
  const lowerParent = process.platform === 'win32' ? normalizedParent.toLowerCase() : normalizedParent;
  const lowerTarget = process.platform === 'win32' ? normalizedTarget.toLowerCase() : normalizedTarget;
  return lowerTarget === lowerParent || lowerTarget.startsWith(lowerParent + sep);
}

export function resolveDbPath(rawPath) {
  if (rawPath === ':memory:') return ':memory:';
  const candidate = rawPath
    ? isAbsolute(rawPath)
      ? resolve(rawPath)
      : resolve(REPO_ROOT, rawPath)
    : join(REPO_ROOT, 'data', 'sync-server.sqlite');

  const distDir = join(REPO_ROOT, 'dist');
  const publicDir = join(REPO_ROOT, 'public');
  if (isPathInside(distDir, candidate) || isPathInside(publicDir, candidate)) {
    throw new Error('Sync SQLite database path must stay outside dist/ and public/');
  }
  return candidate;
}

export function resolveSyncConfig(options = {}, env = process.env) {
  const host = options.host ?? LOCALHOST_BIND;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Sync server must bind to localhost only (received "${host}")`);
  }

  const rawPort = options.port ?? env.PORT ?? DEFAULT_PORT;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${rawPort}"`);
  }

  const originsInput = [
    ...parseCsvList(options.allowedOrigins ?? env.NUQTA_SYNC_ALLOWED_ORIGINS),
    ...parseCsvList(env.NUQTA_TAILSCALE_ORIGIN),
  ];
  const allowedOrigins = normalizeOrigins(originsInput);

  const rawToken = options.authToken !== undefined ? options.authToken : env.NUQTA_SYNC_TOKEN;
  const authToken = typeof rawToken === 'string' && rawToken.trim().length > 0 ? rawToken.trim() : null;

  const allowedTailscaleUsers = normalizeUsers(
    options.allowedTailscaleUsers ?? env.NUQTA_SYNC_ALLOWED_USERS
  );

  const requireTokenWithTailscale = Boolean(
    options.requireTokenWithTailscale ?? env.NUQTA_SYNC_REQUIRE_TOKEN_WITH_TAILSCALE === 'true'
  );

  const dbPath = resolveDbPath(options.dbPath ?? env.NUQTA_SYNC_DB_PATH);

  const maxMessageSize = Number(options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE);
  const maxPayloadSize = Number(options.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE);
  const maxBatchSize = Number(options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
  const handshakeTimeoutMs = Number(options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS);
  const heartbeatIntervalMs = Number(options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);

  return {
    host,
    port,
    dbPath,
    allowedOrigins,
    authToken,
    allowedTailscaleUsers,
    requireTokenWithTailscale,
    maxMessageSize,
    maxPayloadSize,
    maxBatchSize,
    handshakeTimeoutMs,
    heartbeatIntervalMs,
  };
}

export function isSyncAuthConfigured(config) {
  if (!config || !(config.allowedOrigins instanceof Set) || config.allowedOrigins.size === 0) {
    return false;
  }
  const hasToken = typeof config.authToken === 'string' && config.authToken.length > 0;
  const hasTailscaleUsers =
    config.allowedTailscaleUsers instanceof Set && config.allowedTailscaleUsers.size > 0;

  if (config.requireTokenWithTailscale) {
    return hasToken && hasTailscaleUsers;
  }
  return hasToken || hasTailscaleUsers;
}
