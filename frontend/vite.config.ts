import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = path.dirname(fileURLToPath(import.meta.url))
const shared = path.resolve(here, '../shared/src')

/**
 * No `base`, on purpose: Vite's default absolute `/assets/…` is the only path
 * correct at every route depth. A relative `./assets/…` makes a reload of
 * `/seller/orders` ask for `/seller/assets/index-xxx.js`, get `index.html` back
 * from the SPA rewrite, and render a blank page.
 *
 * The Android APK does not need a build of its own either - it is a WebView
 * that loads this same deployed site (docs/DEPLOY.md §6).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@shared\/(.*)\.js$/, replacement: `${shared}/$1.ts` }],
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [here, shared] },
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // Photos are fetched at this origin and passed on to Cloudinary - in
      // production by the rewrite in vercel.json, here by this. The two must
      // agree on the path (src/lib/photoUrl.ts, held by tests/photo-url.test.ts).
      '/photo': {
        target: 'https://res.cloudinary.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/photo\/([^/]+)\//, '/$1/image/upload/'),
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})
