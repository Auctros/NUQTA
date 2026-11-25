import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { attachYoutubeProxy } from './scripts/youtube-proxy.mjs';

export default defineConfig(() => {
  return {
    // GitHub Pages serves this project from /NUQTA/; local development stays at /.
    base: process.env.GITHUB_PAGES === 'true' ? '/NUQTA/' : '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        // The YouTube proxy also runs in dev, so `npm run dev` exercises the same
        // `/api/youtube/*` route the production server serves. No key => the app
        // shows its "not configured" state instead of failing silently.
        name: 'nuqta-youtube-proxy',
        configureServer(server) {
          const proxy = attachYoutubeProxy();
          server.middlewares.use(async (req, res, next) => {
            if (!(req.url || '').startsWith('/api/youtube/')) return next();
            const handled = await proxy.handle(req, res);
            if (!handled) next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
