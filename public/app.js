// Front end. All text from the API is inserted with textContent, never as HTML.
const $ = (id) => document.getElementById(id)
const BADGE_HOST = 'https://benchmarks.caelaralabs.com'
const LINK = 'https://caelaralabs.com'

export function badgeSnippets(domain) {
  const d = String(domain).trim().toLowerCase()
  const src = `${BADGE_HOST}/verify/domain-trust.svg?domain=${encodeURIComponent(d)}`
  return { src, markdown: `[![Domain Trust](${src})](${LINK})`, html: `<a href="${LINK}"><img src="${src}" alt="Domain Trust" height="20"></a>` }
}

function el(tag, text, cls) {
  const n = document.createElement(tag)
  if (text !== undefined) n.textContent = text
  if (cls) n.className = cls
  return n
}
const sev = (s) => (s === 'high' ? 'pill bad' : s === 'medium' ? 'pill warn' : 'pill')
const riskTone = (r) => (/low/i.test(r) ? 'pill ok' : /high|critical/i.test(r) ? 'pill bad' : 'pill warn')

// Shows the top-level plain values of an object as a small list; nested objects are summarised by key.
function facts(box, obj) {
  box.replaceChildren()
  if (!obj) return box.append(el('p', 'Unavailable. Try again shortly.', 'muted'))
  const ul = el('ul')
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || k === 'partial') continue
    const label = k.replace(/_/g, ' ')
    if (typeof v === 'object') ul.append(el('li', Array.isArray(v) ? `${label}: ${v.length} item(s)` : `${label}: ${Object.keys(v).length} field(s)`))
    else ul.append(el('li', `${label}: ${v}`))
  }
  box.append(ul.childNodes.length ? ul : el('p', 'Nothing to show.', 'muted'))
}

function updateBadge() {
  const d = $('bd').value.trim()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return
  const s = badgeSnippets(d)
  $('bimg').src = s.src; $('md').value = s.markdown; $('ht').value = s.html
}

async function main() {
  try {
    const c = await (await fetch('/api/config')).json()
    if (c.brand) { $('brand').textContent = c.brand; document.title = c.brand }
  } catch { /* keep default */ }
  $('bd').addEventListener('input', updateBadge)
  $('f').addEventListener('submit', async (e) => {
    e.preventDefault()
    const status = $('status'), go = $('go')
    status.className = 'status'; status.textContent = 'Scanning. This usually takes a few seconds.'; go.disabled = true
    try {
      const qs = new URLSearchParams({ address: $('addr').value.trim() })
      if ($('chain').value) qs.set('chain', $('chain').value)
      const r = await fetch('/api/scan?' + qs)
      const j = await r.json()
      if (!r.ok) { status.className = 'status err'; status.textContent = j.error || 'The scan failed.'; return }
      status.textContent = j.unavailable.length ? 'Done, but ' + j.unavailable.join(' and ') + ' was unavailable.' : 'Done.'
      const s = j.safety
      const score = $('score'); score.replaceChildren()
      if (s) { score.append(el('div', `${s.score ?? '?'} / 100`, 'big'), el('span', `risk: ${s.risk_level ?? 'unknown'}`, riskTone(String(s.risk_level ?? '')))) } else score.append(el('p', 'Unavailable.', 'muted'))
      facts($('liq'), s && s.liquidity)
      const flags = $('flags'); flags.replaceChildren()
      const list = (s && s.flags) || []
      if (!list.length) flags.append(el('li', 'No risk flags were raised.'))
      for (const f of list) { const li = el('li'); li.append(el('span', f.severity || 'info', sev(f.severity)), document.createTextNode(' ' + (f.detail || f.id))); flags.append(li) }
      facts($('det'), j.details)
      $('disc').textContent = (s && s.disclaimer) || 'Heuristic screen, not financial advice.'
      $('out').hidden = false
    } catch {
      status.className = 'status err'; status.textContent = 'Could not reach the scan service.'
    } finally { go.disabled = false }
  })
}
if (typeof document !== 'undefined' && document.getElementById('f')) main()
