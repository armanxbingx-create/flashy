/**
 * piperManifest — tiny versioned pointer for the Piper voice model.
 *
 * The ~63 MB `.onnx` model is NEVER bundled, committed, or precached.
 * It is downloaded once, lazily, on first pronunciation request and
 * persisted in OPFS (see PiperProvider). The manifest itself is a few
 * hundred bytes and ships with the app shell.
 *
 * Model hosting: Cloudflare Workers Static Assets caps files at 25 MiB,
 * so the model cannot live there. Host both files in Cloudflare R2
 * (public bucket or custom domain) and set `VITE_PIPER_ASSET_BASE_URL`
 * at build time — no credentials, no API, no backend, plain static GETs.
 * After caching, synthesis is offline.
 *
 * R2 layout (exact keys):
 *   piper/en_US-amy-medium.onnx
 *   piper/en_US-amy-medium.onnx.json
 *
 * Final runtime URLs (no redirects, CORS-enabled on R2):
 *   <VITE_PIPER_ASSET_BASE_URL>/piper/en_US-amy-medium.onnx
 *   <VITE_PIPER_ASSET_BASE_URL>/piper/en_US-amy-medium.onnx.json
 *
 * Fallback default: verified Hugging Face source for `en_US-amy-medium`
 * (kept only so local dev builds still resolve; iOS workers cannot fetch
 * it reliably — see diagnostics. Set the R2 base URL for production).
 *
 * License note (personal-use PWA): Amy weights derive from
 * MycroftAI/mimic3-voices (CC-BY-SA-4.0, attribution required) and were
 * finetuned from the Lessac Blizzard voice (research-only upstream terms —
 * see investigation report). Keep MODEL_CARD + attribution next to the
 * hosted model. Not cleared for commercial redistribution.
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

const HF_MODEL_URL =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx'
const HF_CONFIG_URL =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json'

export const PIPER_VOICE_ID = 'en_US-amy-medium' as const

/** Bump to force a one-time re-download (old OPFS copy is removed). */
export const PIPER_MODEL_VERSION = 'amy-medium-rhasspy-v1.0.0-r1' as const

export const PIPER_MODEL_FILE = 'en_US-amy-medium.onnx' as const
export const PIPER_CONFIG_FILE = 'en_US-amy-medium.onnx.json' as const

/**
 * Single configurable asset base, e.g. `https://<R2-public-host>` (no
 * trailing slash needed). Final URLs are `${base}/piper/<file>`.
 * Unset (local dev default) → Hugging Face fallback URLs.
 */
const PIPER_ASSET_BASE_URL = (env['VITE_PIPER_ASSET_BASE_URL'] ?? '').replace(/\/+$/, '')

export const PIPER_MODEL_URL = PIPER_ASSET_BASE_URL
  ? `${PIPER_ASSET_BASE_URL}/piper/${PIPER_MODEL_FILE}`
  : HF_MODEL_URL
export const PIPER_CONFIG_URL = PIPER_ASSET_BASE_URL
  ? `${PIPER_ASSET_BASE_URL}/piper/${PIPER_CONFIG_FILE}`
  : HF_CONFIG_URL

/** Exact byte size from rhasspy `voices.json` — used as a sanity check. */
export const PIPER_EXPECTED_MODEL_BYTES = 63201294

/** MD5 from rhasspy `voices.json` (informational; browsers lack MD5). */
export const PIPER_EXPECTED_MODEL_MD5 = '778d28aeb95fcdf8a882344d9df142fc'

/** Key for the tiny version flag in localStorage (never the model). */
export const PIPER_VERSION_STORAGE_KEY = 'flashy:piper:model-version'

/** ONNX Runtime Web version this integration was verified against. */
export const PIPER_ORT_VERSION = '1.22.0' as const
