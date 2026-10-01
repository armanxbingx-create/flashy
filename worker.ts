/**
 * TEMPORARY diagnostic Worker entry — remove after the Piper fetch investigation.
 *
 * Wraps the existing Static Assets deployment (`./dist`, SPA fallback) so a
 * single diagnostic endpoint can run a server-side fetch. Every other
 * request falls through to `env.ASSETS` untouched, preserving current site
 * behavior exactly.
 *
 * Routes:
 * - GET /__diag/piper-github-fetch → server-side fetch of the small public
 *   Piper config Release asset; returns response metadata ONLY as JSON.
 *   Never reads or returns the body, never touches the 63 MB model.
 * - GET /piper/en_US-amy-medium.onnx.json → streams the config asset
 *   same-origin (immutable, publicly cacheable).
 * - GET /piper/en_US-amy-medium.onnx → streams the ~63 MB model asset
 *   same-origin (immutable, publicly cacheable). The body is streamed
 *   directly and never buffered in Worker memory.
 * - everything else → env.ASSETS.fetch(request)
 */

const GITHUB_CONFIG_URL =
  'https://github.com/armanxbingx-create/flashy/releases/download/piper-assets-v1/en_US-amy-medium.onnx.json'
const GITHUB_MODEL_URL =
  'https://github.com/armanxbingx-create/flashy/releases/download/piper-assets-v1/en_US-amy-medium.onnx'

// Exact same-origin paths served by this worker. Anything else falls
// through to static assets, so a stray /piper/* path can never leak the
// proxy to unintended upstreams.
const PIPER_ASSET_ROUTES: Record<string, string> = {
  '/piper/en_US-amy-medium.onnx.json': GITHUB_CONFIG_URL,
  '/piper/en_US-amy-medium.onnx': GITHUB_MODEL_URL,
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

function describeError(error: unknown): {
  errorConstructor: string
  errorName: string
  errorMessage: string
} {
  let errorConstructor: string = typeof error
  try {
    const ctor = (error as { constructor?: { name?: unknown } } | null)?.constructor
    if (ctor && typeof ctor.name === 'string' && ctor.name) {
      errorConstructor = ctor.name
    }
  } catch {
    // Keep the typeof fallback.
  }
  if (error instanceof Error) {
    return {
      errorConstructor,
      errorName: error.name || 'Error',
      errorMessage: error.message || String(error),
    }
  }
  return {
    errorConstructor,
    errorName: 'Unknown',
    errorMessage: String(error),
  }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Temporary diagnostic: never store this response anywhere.
      'cache-control': 'no-store',
    },
  })
}

async function handlePiperGithubFetch(): Promise<Response> {
  const startedAt = Date.now()
  try {
    // Deliberately do NOT read the body: headers + final URL are enough.
    const upstream = await fetch(GITHUB_CONFIG_URL, {
      method: 'GET',
      redirect: 'follow',
    })
    return jsonResponse({
      success: true,
      status: upstream.status,
      statusText: upstream.statusText || null,
      ok: upstream.ok,
      url: upstream.url || null,
      contentType: upstream.headers.get('content-type'),
      contentLength: upstream.headers.get('content-length'),
      redirected: upstream.redirected,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    return jsonResponse({
      success: false,
      ...describeError(error),
      durationMs: Date.now() - startedAt,
    })
  }
}

/**
 * Streams a Piper Release asset same-origin. The upstream body is piped
 * directly to the client — never arrayBuffer()/blob()/text(), so the ~63 MB
 * model never sits in Worker memory. Only the two exact paths in
 * PIPER_ASSET_ROUTES are served; upstream must be 2xx or a 502 is returned.
 */
async function handlePiperAsset(upstreamUrl: string): Promise<Response> {
  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'follow',
    })
  } catch (error) {
    const info = describeError(error)
    return new Response(
      JSON.stringify({ success: false, error: `${info.errorName}: ${info.errorMessage}` }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ success: false, error: `Upstream responded with HTTP ${upstream.status}` }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  }
  // Versioned, immutable release assets: publicly cacheable for a year.
  // Nothing user-specific is ever part of these responses.
  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)
  const etag = upstream.headers.get('etag')
  if (etag) headers.set('etag', etag)
  const lastModified = upstream.headers.get('last-modified')
  if (lastModified) headers.set('last-modified', lastModified)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/__diag/piper-github-fetch') {
      return handlePiperGithubFetch()
    }
    if (request.method === 'GET') {
      const upstreamUrl = PIPER_ASSET_ROUTES[url.pathname]
      if (upstreamUrl) {
        return handlePiperAsset(upstreamUrl)
      }
    }
    return env.ASSETS.fetch(request)
  },
}
