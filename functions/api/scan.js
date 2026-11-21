// GET /api/scan?address=<token or mint>&chain=base|ethereum|arbitrum|optimism|solana
// Read-only: one safety score (composite) plus one detail audit (atomic). Nothing here connects a wallet or sends a transaction.
import { CRYPTO_HOST, callCaelara, callerAllowed, json } from '../../lib/proxy.js'

const EVM = /^0x[0-9a-fA-F]{40}$/
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const CHAINS = ['base', 'ethereum', 'arbitrum', 'optimism', 'solana']

export function classify(address, chain) {
  const a = typeof address === 'string' ? address.trim() : ''
  const evm = EVM.test(a)
  const sol = !evm && SOL.test(a)
  if (!evm && !sol) return { error: 'Enter a token contract address (0x…) or a Solana mint address.' }
  const c = chain ? String(chain).toLowerCase() : sol ? 'solana' : 'base'
  if (!CHAINS.includes(c)) return { error: 'Unsupported chain. Use base, ethereum, arbitrum, optimism or solana.' }
  if ((c === 'solana') !== sol) return { error: c === 'solana' ? 'That is not a Solana mint address.' : 'That address does not match the selected chain.' }
  return { address: a, chain: c, solana: sol }
}

export async function handleScan(request, env, fetcher = fetch) {
  if (!callerAllowed(request, env)) return json({ error: 'This endpoint is only available from the site itself.' }, 403)
  if (!env.CAELARA_API_KEY) return json({ error: 'CAELARA_API_KEY is not set. Add it as a secret in your Cloudflare project.' }, 503)
  const q = new URL(request.url).searchParams
  const t = classify(q.get('address'), q.get('chain'))
  if (t.error) return json({ error: t.error }, 400)
  const a = encodeURIComponent(t.address)
  const [safety, detail] = await Promise.all([
    callCaelara(fetcher, t.solana ? `${CRYPTO_HOST}/v1/token-safety-composite?address=${a}` : `${CRYPTO_HOST}/v1/token-safety-composite?address=${a}&chain=${t.chain}`, env.CAELARA_API_KEY),
    callCaelara(fetcher, t.solana ? `${CRYPTO_HOST}/v1/solana-mint-auditor?mint=${a}` : `${CRYPTO_HOST}/v1/base-erc20-inspector?address=${a}&chain=${t.chain}`, env.CAELARA_API_KEY),
  ])
  if (!safety.ok && !detail.ok) return json({ error: safety.error }, safety.status)
  const s = safety.ok && safety.body.partial !== true ? safety.body : null
  const d = detail.ok && detail.body.partial !== true ? detail.body : null
  return json({
    address: t.address,
    chain: t.chain,
    safety: s && { score: s.score, risk_level: s.risk_level, flags: s.flags, liquidity: s.liquidity, disclaimer: s.disclaimer },
    details: d,
    unavailable: [!s && 'safety score', !d && 'on-chain details'].filter(Boolean),
  })
}

export const onRequestGet = ({ request, env }) => handleScan(request, env)
