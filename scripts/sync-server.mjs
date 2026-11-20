#!/usr/bin/env node
/**
 * NUQTA Sync Server Entry Point & Factory (Stage 1)
 *
 * Wraps the modular sync infrastructure in scripts/sync/ on a localhost-only
 * HTTP server. For production static+sync serving on 127.0.0.1:3000, use
 * scripts/serve-dist.mjs (which attaches the same sync module to the existing
 * HTTP server).
 */

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { attachSyncToServer } from './sync/attach.mjs';
import { resolveSyncConfig } from './sync/config.mjs';

export { attachSyncToServer } from './sync/attach.mjs';
export { resolveSyncConfig, isSyncAuthConfigured } from './sync/config.mjs';
export { openSyncDatabase, createSyncRepository } from './sync/db.mjs';

export async function createSyncServer(options = {}) {
  const config = resolveSyncConfig(options);
  let sync = null;

  const httpServer = createServer((req, res) => {
    if (sync && sync.handleHttpRequest(req, res)) {
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  sync = attachSyncToServer(httpServer, options);

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      httpServer.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };
    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(config.port, config.host);
  });

  const address = httpServer.address();
  const actualPort = typeof address === 'object' && address ? address.port : config.port;

  async function close() {
    await sync.close();
    await new Promise((resolve) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close(() => resolve());
    });
  }

  return {
    httpServer,
    wss: sync.wss,
    db: sync.db,
    repo: sync.repo,
    config: sync.config,
    port: actualPort,
    host: config.host,
    close,
  };
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url.startsWith('file:') &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const server = await createSyncServer();
  console.log(`NUQTA Sync Server listening on http://${server.host}:${server.port}/`);
  console.log(`WebSocket endpoint: ws://${server.host}:${server.port}/sync`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
