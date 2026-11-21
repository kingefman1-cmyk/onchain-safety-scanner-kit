// Shared helpers for the Pages Functions. The Caelara key lives only in the Function environment and is never sent to the browser.

export const CRYPTO_HOST = 'https://crypto.caelaralabs.com'

const FQDN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const BLOCKED_TLD = new Set(['local', 'localhost', 'internal', 'lan', 'home', 'corp', 'intranet', 'invalid', 'test', 'example', 'onion', 'arpa'])

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  })
}

// A public hostname only: no IP literals, ports, paths or internal suffixes.
export function normaliseDomain(input) {
  if (typeof input !== 'string') return null
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!FQDN.test(s)) return null
  return BLOCKED_TLD.has(s.slice(s.lastIndexOf('.') + 1)) ? null : s
}

export function normaliseUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null
  let u
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input.trim()) ? input.trim() : 'https://' + input.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  return normaliseDomain(u.hostname) ? u.toString() : null
}

// Only pages served by this site may call the API, so other sites cannot spend your credits. Server-to-server callers
// without browser headers are refused unless ALLOW_DIRECT_CALLS is set to "true".
export function callerAllowed(request, env) {
  const site = request.headers.get('Sec-Fetch-Site')
  if (site === 'same-origin') return true
  const host = new URL(request.url).host
  for (const h of ['Origin', 'Referer']) {
    const v = request.headers.get(h)
    if (v) {
      try {
        return new URL(v).host === host
      } catch {
        return false
      }
    }
  }
  return env.ALLOW_DIRECT_CALLS === 'true'
}

// Calls one Caelara endpoint with the configured key. Payment and key problems come back as readable errors.
export async function callCaelara(fetcher, url, key) {
  let res
  try {
    res = await fetcher(url, { headers: { Accept: 'application/json', 'X-Caelara-Key': key, 'User-Agent': 'CaelaraLabs-Starter/1.0' }, signal: AbortSignal.timeout(25000) })
  } catch {
    return { ok: false, status: 502, error: 'The data service did not answer in time. Try again.' }
  }
  let body = null
  try {
    body = await res.json()
  } catch {
    /* not JSON */
  }
  if (res.status === 401 || res.status === 402 || res.status === 429) return { ok: false, status: 503, error: 'The service key is missing, out of credit or rate limited. The site owner needs to check CAELARA_API_KEY.' }
  if (!res.ok || !body) return { ok: false, status: 502, error: typeof body?.error === 'string' ? body.error : 'The data service returned an error.' }
  return { ok: true, body }
}

export const brandName = (env) => (env.NEXT_PUBLIC_BRAND_NAME || 'Token Safety Scanner').slice(0, 60)
