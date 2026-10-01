import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const SW_TEMPLATE = 'public/sw.js'
const GENERATED_SW = 'sw.js'
const HASHED_ASSET_DIR = 'assets/'

// Files under public/ that belong to the app shell. The service worker itself
// is excluded: the browser always validates it against the network.
// Large Piper TTS model files are NEVER precached (the ~63 MB .onnx would
// delay install and re-download on every build). They are fetched lazily on
// first pronunciation request and persisted in OPFS instead. The large
// ONNX Runtime WASM binaries (~10–21 MB) are likewise excluded: they load
// on demand on first synthesis and are then served from the service worker's
// runtime cache, keeping PWA install light on iPhone 8.
const PRECACHE_EXCLUDED = [/\.onnx$/, /\.onnx\.json$/, /\.wasm$/, /^piper\//, /^models\//, /^voices\//]

function isPrecacheExcluded(url: string): boolean {
  return PRECACHE_EXCLUDED.some((pattern) => pattern.test(url))
}

function collectShellUrls(dir: string, base = '/'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === GENERATED_SW) return []
    const url = base + entry.name
    if (entry.isDirectory()) return collectShellUrls(join(dir, entry.name), `${url}/`)
    if (isPrecacheExcluded(url)) return []
    return [url]
  })
}

function readBundleText(entry: { source: string | Uint8Array }): string {
  return typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source)
}

// Rewrites public/sw.js into dist/sw.js with the exact production asset list
// and a content-derived cache version, so precaching and cache busting follow
// the current build instead of hard-coded filenames.
function serviceWorkerPlugin(): Plugin {
  let root = ''
  let outDir = ''

  return {
    name: 'flashy:service-worker',
    apply: 'build',

    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },

    writeBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((file) => file.startsWith(HASHED_ASSET_DIR) && !file.endsWith('.map'))
        .map((file) => `/${file}`)
        .filter((url) => !isPrecacheExcluded(url))
        .sort()

      const shell = ['/', '/index.html', ...collectShellUrls(join(root, 'public')), ...assets].sort()

      const htmlEntry = bundle['index.html']
      const htmlSource =
        htmlEntry && 'source' in htmlEntry
          ? readBundleText(htmlEntry)
          : readFileSync(join(outDir, 'index.html'), 'utf8')

      const buildId = createHash('sha256')
        .update(`${shell.join('\n')}\n${htmlSource}`)
        .digest('hex')
        .slice(0, 12)

      const template = readFileSync(resolve(root, SW_TEMPLATE), 'utf8')
      const source = template
        .replace(/^const CACHE_NAME = .*$/m, `const CACHE_NAME = 'flashy-${buildId}'`)
        .replace(/^const SHELL_ASSETS = .*$/m, `const SHELL_ASSETS = ${JSON.stringify(shell, null, 2)}`)

      if (!source.includes(`'flashy-${buildId}'`)) {
        throw new Error(`flashy: failed to inject the cache version from ${SW_TEMPLATE}`)
      }
      if (!source.includes('"/index.html"')) {
        throw new Error(`flashy: failed to inject the precache manifest from ${SW_TEMPLATE}`)
      }

      writeFileSync(join(outDir, GENERATED_SW), source)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
})
