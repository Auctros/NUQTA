#!/usr/bin/env node
/**
 * Minimal static file server for NUQTA production build.
 * Serves files from dist/ with SPA fallback and correct MIME types.
 * Zero dependencies: uses only Node.js built-in modules.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachSyncToServer } from './sync/attach.mjs';
import { attachYoutubeProxy } from './youtube-proxy.mjs';
import { attachBooksProxy } from './books-proxy.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');
const DEFAULT_PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Tailscale Serve will proxy to this local address

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.manifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain',
};

function getMimeType(ext) {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

function isHashedAsset(filePath) {
  // Hashed assets like index-<hash>.js or style-<hash>.css
  return /-[a-f0-9]{8,}\.(js|css)$/.test(filePath);
}

async function serveFile(res, filePath, statusCode = 200) {
  const ext = extname(filePath);
  const mimeType = getMimeType(ext);

  const headers = {
    'Content-Type': mimeType,
    'Cache-Control': 'no-cache',
  };

  // Hashed static assets can be cached aggressively (filenames contain content hash)
  if (isHashedAsset(filePath)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }

  // Service worker must not be cached and must be served from root scope
  if (filePath.endsWith('sw.js')) {
    headers['Cache-Control'] = 'no-cache';
    headers['Service-Worker-Allowed'] = '/';
  }

  res.writeHead(statusCode, headers);

  try {
    const content = await readFile(filePath);
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

/**
 * Known SPA routes that should fall back to index.html for client-side routing.
 * Any other path that looks like a static asset (has a file extension) and is not
 * found should return 404.
 */
const SPA_ROUTES = new Set([
  '/', '/tasks', '/habits', '/goals', '/focus', '/calendar',
  '/quran', '/reading', '/workout', '/drawing', '/archive',
  '/finance', '/health', '/journal', '/insights', '/settings',
  '/simulator', '/today'
]);

function isStaticAsset(pathname) {
  // A path with a file extension (e.g. /assets/index.js, /icon-192.png)
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function resolveSafeDistPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some((seg) => seg === '.' || seg === '..' || seg.startsWith('.'))) {
    return null;
  }
  const candidate = resolve(DIST_DIR, ...segments);
  const lowerCandidate = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
  const lowerRoot = process.platform === 'win32' ? DIST_DIR.toLowerCase() : DIST_DIR;
  if (lowerCandidate !== lowerRoot && !lowerCandidate.startsWith(lowerRoot + sep)) {
    return null;
  }
  return candidate;
}

export async function createDistServer(options = {}) {
  const port = Number(options.port ?? DEFAULT_PORT);
  const distDir = options.distDir ? resolve(options.distDir) : DIST_DIR;
  let sync = null;
  const youtube = attachYoutubeProxy(options);
  const books = attachBooksProxy(options);

  async function handleRequest(req, res) {
    if (sync && sync.handleHttpRequest(req, res)) {
      return;
    }

    // Same-origin YouTube proxy. Handles `/api/youtube/*` and returns false otherwise.
    if (youtube && (await youtube.handle(req, res))) {
      return;
    }

    // Same-origin book-catalogue proxy. Handles `/api/books/*`.
    if (books && (await books.handle(req, res))) {
      return;
    }

    let url;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || HOST}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    let pathname = url.pathname;
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = options.distDir
      ? (() => {
          const safe = resolveSafeDistPath(pathname);
          if (!safe) return null;
          const rel = safe.slice(DIST_DIR.length).replace(/^[/\\]+/, '');
          return resolve(distDir, rel);
        })()
      : resolveSafeDistPath(pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    try {
      const stats = await stat(filePath);

      if (stats.isDirectory()) {
        await serveFile(res, join(filePath, 'index.html'));
        return;
      }

      if (stats.isFile()) {
        await serveFile(res, filePath);
        return;
      }
    } catch {
      if (isStaticAsset(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      if (SPA_ROUTES.has(pathname) || !isStaticAsset(pathname)) {
        await serveFile(res, join(distDir, 'index.html'), 200);
        return;
      }

      await serveFile(res, join(distDir, 'index.html'), 200);
      return;
    }

    await serveFile(res, join(distDir, 'index.html'), 200);
  }

  const server = createServer(handleRequest);
  sync = attachSyncToServer(server, { ...options, host: HOST, port });

  await new Promise((resolveListen, rejectListen) => {
    const onError = (err) => {
      server.off('listening', onListening);
      rejectListen(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  async function close() {
    await sync.close();
    await new Promise((resolveClose) => {
      if (!server.listening) {
        resolveClose();
        return;
      }
      server.close(() => resolveClose());
    });
  }

  return { server, sync, port: actualPort, host: HOST, close };
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url.startsWith('file:') &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const instance = await createDistServer();
  console.log(`NUQTA production server running at http://${instance.host}:${instance.port}/`);
  console.log(`Serving files from: ${DIST_DIR}`);
  console.log(`Sync WebSocket endpoint attached at ws://${instance.host}:${instance.port}/sync`);
  console.log('Ready for Tailscale Serve reverse proxy on this address.');

  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
