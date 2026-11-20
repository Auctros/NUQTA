import { createHash, timingSafeEqual } from 'node:crypto';
import { isSyncAuthConfigured } from './config.mjs';

export function validateOrigin(originHeader, allowedOrigins) {
  if (typeof originHeader !== 'string' || originHeader.trim().length === 0) {
    return false;
  }
  if (!(allowedOrigins instanceof Set) || allowedOrigins.size === 0) {
    return false;
  }
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return allowedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

export function extractTailscaleIdentity(headers = {}) {
  const rawLogin = headers['tailscale-user-login'] ?? headers['x-tailscale-user'];
  const rawName = headers['tailscale-user-name'] ?? headers['x-tailscale-profile'];
  const login = typeof rawLogin === 'string' && rawLogin.trim().length > 0 ? rawLogin.trim().toLowerCase() : null;
  const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
  return { login, name };
}

export function extractBearerToken(headers = {}) {
  const authHeader = headers['authorization'];
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }
  const altHeader = headers['x-sync-token'];
  if (typeof altHeader === 'string' && altHeader.trim().length > 0) {
    return altHeader.trim();
  }
  return null;
}

export function timingSafeTokenEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length === 0) {
    return false;
  }
  const digestA = createHash('sha256').update(provided, 'utf8').digest();
  const digestB = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Evaluate request authentication.
 * Never treats a device UUID as authentication and fails closed when auth config is missing.
 */
export function authenticateRequest(req, config, { mode = 'http', handshakeToken = null } = {}) {
  if (!isSyncAuthConfigured(config)) {
    return {
      authenticated: false,
      pendingHandshake: false,
      status: 503,
      code: 'sync_not_configured',
      error: 'Sync authentication configuration is missing',
    };
  }

  const headers = req?.headers ?? {};
  const { login: tailscaleLogin } = extractTailscaleIdentity(headers);
  const headerToken = extractBearerToken(headers);
  const providedToken = handshakeToken ?? headerToken;

  let tailscaleOk = false;
  if (tailscaleLogin !== null && config.allowedTailscaleUsers.size > 0) {
    if (!config.allowedTailscaleUsers.has(tailscaleLogin)) {
      return {
        authenticated: false,
        pendingHandshake: false,
        status: 403,
        code: 'tailscale_user_forbidden',
        error: 'Tailscale identity is not authorized',
      };
    }
    tailscaleOk = true;
  }

  let tokenOk = false;
  if (providedToken !== null) {
    if (!config.authToken || !timingSafeTokenEqual(providedToken, config.authToken)) {
      return {
        authenticated: false,
        pendingHandshake: false,
        status: 401,
        code: 'invalid_token',
        error: 'Invalid sync token',
      };
    }
    tokenOk = true;
  }

  if (config.requireTokenWithTailscale) {
    if (tailscaleOk && tokenOk) {
      return {
        authenticated: true,
        authSubject: `tailscale:${tailscaleLogin}`,
        authMethod: 'tailscale+token',
        tailscaleUser: tailscaleLogin,
      };
    }
    if (mode === 'ws-upgrade' && tailscaleOk && providedToken === null && config.authToken) {
      return {
        authenticated: false,
        pendingHandshake: true,
        tailscaleUser: tailscaleLogin,
      };
    }
    return {
      authenticated: false,
      pendingHandshake: false,
      status: tailscaleOk ? 401 : 403,
      code: 'authentication_required',
      error: 'Tailscale identity and sync token are required',
    };
  }

  if (tailscaleOk || tokenOk) {
    const authMethod = tailscaleOk && tokenOk ? 'tailscale+token' : tailscaleOk ? 'tailscale' : 'token';
    const authSubject = tailscaleOk ? `tailscale:${tailscaleLogin}` : 'token:shared';
    return {
      authenticated: true,
      authSubject,
      authMethod,
      tailscaleUser: tailscaleLogin,
    };
  }

  if (mode === 'ws-upgrade' && config.authToken) {
    return {
      authenticated: false,
      pendingHandshake: true,
      tailscaleUser: null,
    };
  }

  return {
    authenticated: false,
    pendingHandshake: false,
    status: 401,
    code: 'authentication_required',
    error: 'Authentication required',
  };
}
