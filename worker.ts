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
 * - everything else → env.ASSETS.fetch(request)
 */

const GITHUB_CONFIG_URL =
  'https://github.com/armanxbingx-create/flashy/releases/download/piper-assets-v1/en_US-amy-medium.onnx.json'

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/__diag/piper-github-fetch') {
      return handlePiperGithubFetch()
    }
    return env.ASSETS.fetch(request)
  },
}
