// node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, handleScan } from '../functions/api/scan.js'
import { onRequestGet as config } from '../functions/api/config.js'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const KEY = 'ck_test_value'
const same = { 'Sec-Fetch-Site': 'same-origin' }
const req = (qs, headers = same) => new Request('https://scan.example-site.com/api/scan' + qs, { headers })
const j = (o, status = 200) => new Response(JSON.stringify(o), { status })
const EVM = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const safety = { address: EVM, chain: 'base', score: 88, risk_level: 'low', flags: [{ id: 'owner_privileged', severity: 'low', detail: 'Owner has not renounced' }], liquidity: { pools: 3 }, disclaimer: 'Heuristic screen, not financial advice.' }
const upstream = (calls, over = {}) => async (url, init) => {
  calls.push({ url: String(url), key: init.headers['X-Caelara-Key'] })
  if (String(url).includes('token-safety-composite')) return over.safety ?? j(safety)
  return over.detail ?? j({ name: 'USD Coin', decimals: 6 })
}

test('an EVM scan calls the composite and the ERC-20 inspector with the chain and the server-side key', async () => {
  const calls = []
  const r = await handleScan(req(`?address=${EVM}&chain=base`), { CAELARA_API_KEY: KEY }, upstream(calls))
  const b = await r.json()
  assert.equal(r.status, 200); assert.equal(b.safety.score, 88); assert.equal(b.details.decimals, 6); assert.deepEqual(b.unavailable, [])
  assert.equal(calls.length, 2); assert.ok(calls.every((c) => c.key === KEY))
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/token-safety-composite?address=${EVM}&chain=base`))
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/base-erc20-inspector?address=${EVM}&chain=base`))
  assert.ok(!JSON.stringify(b).includes(KEY))
})

test('a Solana scan is detected and uses the mint auditor', async () => {
  const calls = []
  const b = await (await handleScan(req(`?address=${SOL}`), { CAELARA_API_KEY: KEY }, upstream(calls))).json()
  assert.equal(b.chain, 'solana')
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/solana-mint-auditor?mint=${SOL}`))
  assert.ok(calls.some((c) => c.url === `https://crypto.caelaralabs.com/v1/token-safety-composite?address=${SOL}`))
})

test('addresses and chains are validated before any paid call', async () => {
  const calls = []
  for (const qs of ['', '?address=', '?address=0x123', `?address=${EVM}&chain=solana`, `?address=${SOL}&chain=base`, `?address=${EVM}&chain=dogechain`, '?address=<script>alert(1)</script>']) {
    assert.equal((await handleScan(req(qs), { CAELARA_API_KEY: KEY }, upstream(calls))).status, 400, qs)
  }
  assert.equal(calls.length, 0)
  assert.equal(classify(EVM, '').chain, 'base')
})

test('callers outside the site are refused and the key must be configured', async () => {
  const calls = []
  assert.equal((await handleScan(req(`?address=${EVM}`, { Origin: 'https://evil.example' }), { CAELARA_API_KEY: KEY }, upstream(calls))).status, 403)
  assert.equal((await handleScan(req(`?address=${EVM}`), {}, upstream(calls))).status, 503)
  assert.equal(calls.length, 0)
})

test('a partial source is reported, both failing is an error, an unpaid key is explained', async () => {
  const b = await (await handleScan(req(`?address=${EVM}`), { CAELARA_API_KEY: KEY }, upstream([], { detail: j({ partial: true }) }))).json()
  assert.equal(b.details, null); assert.deepEqual(b.unavailable, ['on-chain details'])
  assert.equal((await handleScan(req(`?address=${EVM}`), { CAELARA_API_KEY: KEY }, async () => { throw new Error('x') })).status, 502)
  const unpaid = await handleScan(req(`?address=${EVM}`), { CAELARA_API_KEY: KEY }, async () => j({ error: 'Payment Required' }, 402))
  assert.equal(unpaid.status, 503); assert.match((await unpaid.json()).error, /CAELARA_API_KEY/)
})

test('the kit is read-only: no wallet, signing or trading code', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const files = ['public/app.js', 'public/index.html', 'functions/api/scan.js', 'lib/proxy.js', 'README.md'].map((f) => readFileSync(root + f, 'utf8')).join('\n')
  assert.doesNotMatch(files.replace(/never connects a wallet and never sends a transaction|There is no wallet connection, no signing and no transaction anywhere in the code/g, ''), /window\.ethereum|solana\.signTransaction|connectWallet|sendTransaction/i)
})

test('brand config', async () => {
  assert.equal((await config({ env: { NEXT_PUBLIC_BRAND_NAME: 'Acme Scanner' } }).json()).brand, 'Acme Scanner')
  assert.equal((await config({ env: {} }).json()).brand, 'Token Safety Scanner')
})
