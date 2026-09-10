import { copyFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import { defineConfig, type Plugin } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const bunLinksCache = path.join(os.homedir(), '.bun/install/cache/links')

/** Keep in sync with `src/shared/site-base.ts`. */
const GITHUB_PAGES_BASE = '/parkraum-zaehlung/'

/** OSM only allows http redirect URIs on 127.0.0.1. 33478 is unused by sibling apps. */
const DEV_HOST = '127.0.0.1'
const DEV_PORT = 33478

function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const distDir = path.resolve(projectRoot, 'dist')
      copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? GITHUB_PAGES_BASE : '/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    react({ compiler: true }),
    ...(mode === 'production' ? [githubPagesSpaFallback()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  server: {
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
    fs: {
      allow: [projectRoot, bunLinksCache],
    },
  },
  preview: {
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
  },
  build: {
    target: browserslistToEsbuild(),
    outDir: 'dist',
    sourcemap: true,
  },
  // MapLibre's worker must not land in Vite's optimize-deps cache (missing
  // `maplibre-gl-worker.mjs`). Same pattern as tilda-geo: `setWorkerUrl` + `?worker&url`.
  optimizeDeps: {
    exclude: ['maplibre-gl/dist/maplibre-gl-worker.mjs'],
  },
}))
