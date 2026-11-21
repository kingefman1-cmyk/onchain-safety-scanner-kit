import { brandName, json } from '../../lib/proxy.js'

export function onRequestGet({ env }) {
  return json({ brand: brandName(env) }, 200, { 'Cache-Control': 'public, max-age=300' })
}
