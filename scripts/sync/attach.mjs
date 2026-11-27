import { WebSocket, WebSocketServer } from 'ws';
import {
  authenticateRequest,
  extractTailscaleIdentity,
  validateOrigin,
} from './auth.mjs';
import { isSyncAuthConfigured, resolveSyncConfig } from './config.mjs';
import { createAuthFailureLimiter, rateLimitKey } from './rateLimit.mjs';
import {
  BatchValidationError,
  DeviceIdentityConflictError,
  createSyncRepository,
  openSyncDatabase,
} from './db.mjs';
import {
  isPlainObject,
  isValidUuid,
  normalizeDeviceMetadata,
  parseStrictNonNegativeInt,
  validateSyncMessage,
} from './validation.mjs';

function writeJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function rejectUpgrade(socket, statusCode, statusText, message) {
  const payload = JSON.stringify({ error: message });
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
      `Content-Type: application/json; charset=utf-8\r\n` +
      `Content-Length: ${Buffer.byteLength(payload)}\r\n` +
      `Connection: close\r\n\r\n` +
      payload
  );
  socket.destroy();
}

export function attachSyncToServer(httpServer, options = {}) {
  const config = resolveSyncConfig(options);
  const ownsDb = !options.db;
  const db = options.db ?? openSyncDatabase(config.dbPath);
  const repo = createSyncRepository(db);

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: Math.max(config.maxMessageSize * 2, 128 * 1024),
  });

  /** Active authenticated client sockets keyed by normalized deviceId */
  const clients = new Map();

  // Bounds repeated failed authentication from one caller. Only failures are counted.
  const authLimiter = createAuthFailureLimiter();

  function sendJson(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function completeAuthentication(ws, { deviceId, authResult, metadata }) {
    const normalizedId = deviceId.toLowerCase();
    const { deviceName, platform, appVersion } = normalizeDeviceMetadata(metadata);

    let registration;
    try {
      registration = repo.registerDevice({
        deviceId: normalizedId,
        deviceName,
        platform,
        appVersion,
        authSubject: authResult.authSubject,
        authMethod: authResult.authMethod,
      });
    } catch (err) {
      if (err instanceof DeviceIdentityConflictError) {
        sendJson(ws, { type: 'error', error: 'device_identity_conflict' });
        ws.close(1008, 'device identity conflict');
        return false;
      }
      sendJson(ws, { type: 'error', error: 'registration_failed' });
      ws.close(1011, 'registration failed');
      return false;
    }

    const previous = clients.get(normalizedId);
    if (previous && previous !== ws) {
      previous.close(1000, 'superseded by newer connection');
    }

    ws.isAuthenticated = true;
    ws.deviceId = normalizedId;
    ws.authSubject = authResult.authSubject;
    clients.set(normalizedId, ws);

    sendJson(ws, {
      type: 'welcome',
      deviceId: normalizedId,
      deviceCursor: registration.deviceCursor,
      serverCursor: registration.serverCursor,
      schemaVersion: 2,
      workspaceGeneration: repo.getWorkspaceGeneration(),
    });

    return true;
  }

  function handleSyncMessage(ws, parsed) {
    const validation = validateSyncMessage(parsed, config.maxBatchSize);
    if (!validation.ok) {
      sendJson(ws, {
        type: 'error',
        error: validation.error,
        ...(validation.maxSize !== undefined ? { maxSize: validation.maxSize } : {}),
      });
      return;
    }

    /*
     * A device from a previous workspace generation must not write anything.
     *
     * This is what makes a global reset stick: without it, an offline device would
     * reconnect after the reset and upload its entire pre-reset snapshot, refilling the
     * workspace the user just cleared. The client answers `workspace_reset` by wiping
     * its local copy and adopting the new generation, so it never retries.
     */
    const serverGeneration = repo.getWorkspaceGeneration();
    const clientGeneration = validation.workspaceGeneration ?? 1;
    if (clientGeneration < serverGeneration) {
      sendJson(ws, {
        type: 'error',
        error: 'workspace_reset',
        detail: 'workspace was reset; discard local state and re-pull',
        workspaceGeneration: serverGeneration,
      });
      return;
    }

    let result;
    try {
      result = repo.ingestBatch({
        deviceId: ws.deviceId,
        changes: validation.changes,
        clientCursor: validation.clientCursor,
        maxPayloadSize: config.maxPayloadSize,
      });
    } catch (err) {
      sendJson(ws, {
        type: 'error',
        error: err instanceof BatchValidationError ? 'batch_rejected' : 'internal_error',
        detail: err instanceof BatchValidationError ? err.message : 'failed to commit batch',
      });
      return;
    }

    // Acknowledgements are emitted strictly AFTER durable SQLite transaction commit.
    sendJson(ws, {
      type: 'sync_ack',
      acknowledged: result.acknowledged,
      deviceCursor: result.deviceCursor,
      serverCursor: result.serverCursor,
    });

    // Broadcast committed new changes to all other authenticated connected devices.
    if (result.committedChanges.length > 0) {
      const broadcastPayload = JSON.stringify({
        type: 'sync_broadcast',
        serverCursor: result.serverCursor,
        changes: result.committedChanges,
      });

      for (const client of wss.clients) {
        if (
          client !== ws &&
          client.readyState === WebSocket.OPEN &&
          client.isAuthenticated &&
          client.deviceId !== ws.deviceId
        ) {
          client.send(broadcastPayload);
        }
      }
    }
  }

  function handleAckMessage(ws, parsed) {
    if (!Number.isSafeInteger(parsed.cursor) || parsed.cursor < 0) {
      sendJson(ws, { type: 'error', error: 'invalid cursor' });
      return;
    }

    try {
      const result = repo.acknowledgeCursor({
        deviceId: ws.deviceId,
        cursor: parsed.cursor,
      });
      sendJson(ws, {
        type: 'ack_ok',
        deviceCursor: result.deviceCursor,
        serverCursor: result.serverCursor,
      });
    } catch (err) {
      sendJson(ws, {
        type: 'error',
        error: 'ack_rejected',
        detail: err instanceof BatchValidationError ? err.message : 'invalid cursor',
      });
    }
  }

  wss.on('connection', (ws, req, upgradeAuth) => {
    ws.isAlive = true;
    ws.isAuthenticated = false;
    ws.deviceId = null;

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const queryDeviceId = url.searchParams.get('device_id');
    const headerMeta = {
      deviceName: req.headers['x-device-name'],
      platform: req.headers['x-device-platform'],
      appVersion: req.headers['x-app-version'],
    };

    let authTimer = null;

    const clearAuthTimer = () => {
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }
    };

    if (upgradeAuth.authenticated && queryDeviceId !== null) {
      if (!isValidUuid(queryDeviceId)) {
        ws.close(1008, 'invalid device_id');
        return;
      }
      if (!completeAuthentication(ws, { deviceId: queryDeviceId, authResult: upgradeAuth, metadata: headerMeta })) {
        return;
      }
    } else {
      authTimer = setTimeout(() => {
        if (!ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
          sendJson(ws, { type: 'error', error: 'authentication_timeout' });
          ws.close(1008, 'authentication timeout');
        }
      }, config.handshakeTimeoutMs);
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      const byteLength = Buffer.isBuffer(raw)
        ? raw.byteLength
        : raw instanceof ArrayBuffer
          ? raw.byteLength
          : Buffer.byteLength(String(raw), 'utf8');

      if (byteLength > config.maxMessageSize) {
        sendJson(ws, {
          type: 'error',
          error: 'message_too_large',
          maxSize: config.maxMessageSize,
        });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        sendJson(ws, { type: 'error', error: 'invalid_json' });
        return;
      }

      if (!isPlainObject(parsed)) {
        sendJson(ws, { type: 'error', error: 'invalid_message_format' });
        return;
      }

      if (!ws.isAuthenticated) {
        if (parsed.type !== 'auth') {
          sendJson(ws, { type: 'error', error: 'authentication_required' });
          ws.close(1008, 'authentication required');
          return;
        }

        const candidateDeviceId = parsed.deviceId ?? parsed.device_id ?? queryDeviceId;
        if (!isValidUuid(candidateDeviceId)) {
          sendJson(ws, { type: 'error', error: 'invalid_device_id' });
          ws.close(1008, 'invalid device_id');
          return;
        }

        const handshakeAuth = authenticateRequest(req, config, {
          mode: 'handshake',
          handshakeToken: typeof parsed.token === 'string' ? parsed.token : null,
        });

        if (!handshakeAuth.authenticated) {
          authLimiter.recordFailure(rateLimitKey(req));
          sendJson(ws, { type: 'error', error: handshakeAuth.code || 'authentication_failed' });
          ws.close(1008, handshakeAuth.error || 'authentication failed');
          return;
        }

        clearAuthTimer();
        authLimiter.recordSuccess(rateLimitKey(req));
        completeAuthentication(ws, {
          deviceId: candidateDeviceId,
          authResult: handshakeAuth,
          metadata: {
            deviceName: parsed.deviceName ?? parsed.device_name ?? headerMeta.deviceName,
            platform: parsed.platform ?? headerMeta.platform,
            appVersion: parsed.appVersion ?? parsed.app_version ?? headerMeta.appVersion,
          },
        });
        return;
      }

      switch (parsed.type) {
        case 'ping':
          sendJson(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'sync':
          handleSyncMessage(ws, parsed);
          break;
        case 'ack':
          handleAckMessage(ws, parsed);
          break;
        default:
          sendJson(ws, { type: 'error', error: 'unknown_message_type' });
      }
    });

    const cleanup = () => {
      clearAuthTimer();
      if (ws.deviceId && clients.get(ws.deviceId) === ws) {
        clients.delete(ws.deviceId);
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        if (ws.deviceId && clients.get(ws.deviceId) === ws) {
          clients.delete(ws.deviceId);
        }
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, config.heartbeatIntervalMs);
  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }

  function onUpgrade(req, socket, head) {
    let pathname;
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      pathname = url.pathname;
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request', 'invalid_url');
      return;
    }

    if (pathname !== '/sync') {
      rejectUpgrade(socket, 404, 'Not Found', 'unknown_websocket_path');
      return;
    }

    if (!isSyncAuthConfigured(config)) {
      rejectUpgrade(socket, 503, 'Service Unavailable', 'sync_not_configured');
      return;
    }

    const callerKey = rateLimitKey(req);

    if (!validateOrigin(req.headers.origin, config.allowedOrigins)) {
      authLimiter.recordFailure(callerKey);
      rejectUpgrade(socket, 403, 'Forbidden', 'origin_not_allowed');
      return;
    }

    const upgradeAuth = authenticateRequest(req, config, { mode: 'ws-upgrade' });
    if (!upgradeAuth.authenticated && !upgradeAuth.pendingHandshake) {
      authLimiter.recordFailure(callerKey);
      // A caller that has already exhausted its failure budget gets 429 instead of a
      // fresh 401. Only failures are ever throttled, so a request that authenticates
      // is never rejected no matter how much noise arrives from the same address.
      if (authLimiter.isLimited(callerKey)) {
        rejectUpgrade(socket, 429, 'Too Many Requests', 'too_many_attempts');
        return;
      }
      const statusText = upgradeAuth.status === 403 ? 'Forbidden' : 'Unauthorized';
      rejectUpgrade(socket, upgradeAuth.status || 401, statusText, upgradeAuth.code || 'unauthorized');
      return;
    }

    authLimiter.recordSuccess(callerKey);

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, upgradeAuth);
    });
  }

  httpServer.on('upgrade', onUpgrade);

  function handleHttpRequest(req, res) {
    let url;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    } catch {
      writeJson(res, 400, { error: 'invalid_url' });
      return true;
    }

    const pathname = url.pathname;

    if (pathname === '/health' || pathname === '/sync/health') {
      if (req.method !== 'GET') {
        writeJson(res, 405, { error: 'method_not_allowed' });
        return true;
      }
      writeJson(res, 200, {
        status: 'ok',
        service: 'nuqta-sync',
        version: '1.0.0',
        syncConfigured: isSyncAuthConfigured(config),
        schemaVersion: 2,
        workspaceGeneration: repo.getWorkspaceGeneration(),
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    /*
     * POST /sync/reset — global workspace reset.
     *
     * Authenticated like every other endpoint (the identity header is checked above).
     * This is deliberately the only destructive endpoint, and it is destructive across
     * devices: it bumps the generation so a stale device cannot refill the workspace.
     * Local-only clearing must never call this — see the client's wipe path.
     */
    if (pathname === '/sync/reset') {
      if (req.method !== 'POST') {
        writeJson(res, 405, { error: 'method_not_allowed' });
        return true;
      }
      const callerKey = rateLimitKey(req);
      const authResult = authenticateRequest(req, config, { mode: 'http' });
      if (!authResult.authenticated) {
        authLimiter.recordFailure(callerKey);
        if (authLimiter.isLimited(callerKey)) {
          writeJson(res, 429, { error: 'too_many_attempts' });
          return true;
        }
        writeJson(res, authResult.status || 401, { error: authResult.code || 'unauthorized' });
        return true;
      }
      if (req.headers.origin !== undefined && !validateOrigin(req.headers.origin, config.allowedOrigins)) {
        writeJson(res, 403, { error: 'origin_not_allowed' });
        return true;
      }
      authLimiter.recordSuccess(callerKey);
      const result = repo.resetWorkspace();
      const payload = JSON.stringify({
        type: 'workspace_reset',
        workspaceGeneration: result.generation,
        serverCursor: result.serverCursor,
      });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
          client.send(payload);
        }
      }
      writeJson(res, 200, {
        ok: true,
        workspaceGeneration: result.generation,
        previousGeneration: result.previousGeneration,
      });
      return true;
    }

    if (pathname === '/sync') {
      writeJson(res, 426, { error: 'upgrade_required' });
      return true;
    }

    if (pathname === '/sync/delta') {
      if (req.method !== 'GET') {
        writeJson(res, 405, { error: 'method_not_allowed' });
        return true;
      }

      if (!isSyncAuthConfigured(config)) {
        writeJson(res, 503, { error: 'sync_not_configured' });
        return true;
      }

      // Authentication is evaluated FIRST and independently of Origin. A browser does
      // not send `Origin` on a same-origin GET, so requiring it would break the very
      // path this endpoint serves; but that must never mean "no Origin, no auth check".
      const callerKey = rateLimitKey(req);

      const authResult = authenticateRequest(req, config, { mode: 'http' });
      if (!authResult.authenticated) {
        authLimiter.recordFailure(callerKey);
        // Throttle only failures: an authenticated request is never refused because of
        // unrelated noise from the same address (behind Serve, everyone shares one).
        if (authLimiter.isLimited(callerKey)) {
          writeJson(res, 429, { error: 'too_many_attempts' });
          return true;
        }
        writeJson(res, authResult.status || 401, { error: authResult.code || 'unauthorized' });
        return true;
      }

      // Origin remains an additional browser-side guard (CSRF / cross-site reads), not
      // an authentication mechanism. Validated only when the browser actually sent it.
      if (req.headers.origin !== undefined && !validateOrigin(req.headers.origin, config.allowedOrigins)) {
        writeJson(res, 403, { error: 'origin_not_allowed' });
        return true;
      }

      authLimiter.recordSuccess(callerKey);

      const rawDeviceId = url.searchParams.get('device_id');
      if (!isValidUuid(rawDeviceId)) {
        writeJson(res, 400, { error: 'invalid_device_id' });
        return true;
      }
      const deviceId = rawDeviceId.toLowerCase();

      const device = repo.getDevice(deviceId);
      if (!device) {
        writeJson(res, 404, { error: 'device_not_found' });
        return true;
      }

      if (device.auth_subject !== authResult.authSubject) {
        writeJson(res, 403, { error: 'device_identity_conflict' });
        return true;
      }

      const cursorParam = url.searchParams.get('cursor');
      const cursor = cursorParam === null
        ? repo.getDeviceCursor(deviceId)
        : parseStrictNonNegativeInt(cursorParam);
      if (Number.isNaN(cursor) || cursor < 0) {
        writeJson(res, 400, { error: 'invalid_cursor' });
        return true;
      }

      const limitParam = url.searchParams.get('limit');
      const parsedLimit = limitParam === null
        ? config.maxBatchSize
        : parseStrictNonNegativeInt(limitParam);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > config.maxBatchSize) {
        writeJson(res, 400, { error: 'invalid_limit', maxLimit: config.maxBatchSize });
        return true;
      }

      const excludeSelf = url.searchParams.get('exclude_self') === '1' || url.searchParams.get('exclude_self') === 'true';

      const delta = repo.getDelta({
        cursor,
        limit: parsedLimit,
        excludeDeviceId: excludeSelf ? deviceId : null,
      });

      writeJson(res, 200, {
        ...delta,
        deviceCursor: repo.getDeviceCursor(deviceId),
        workspaceGeneration: repo.getWorkspaceGeneration(),
      });
      return true;
    }

    return false;
  }

  async function close() {
    clearInterval(heartbeatInterval);
    httpServer.off('upgrade', onUpgrade);

    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {
        // ignore close errors during teardown
      }
    }
    clients.clear();

    await new Promise((resolve) => wss.close(() => resolve()));
    if (ownsDb && db.open) {
      db.close();
    }
  }

  return {
    config,
    db,
    repo,
    wss,
    clients,
    handleHttpRequest,
    extractTailscaleIdentity,
    close,
  };
}
