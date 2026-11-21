[![Powered by Caelara Labs](https://benchmarks.caelaralabs.com/verify/powered-by.svg)](https://caelaralabs.com)

# Token & Mint Safety Scanner (white-label starter)

A small Cloudflare Pages site that screens an EVM token or a Solana mint: safety score, the risk flags behind it, liquidity depth and key on-chain facts. Put your own name on it and run it for your community, or as the front end of your own paid service.

It is **read-only**. There is no wallet connection, no signing and no transaction anywhere in the code. It is a static page plus two Pages Functions. Your Caelara key stays in the Function environment and is never sent to the browser.

## One-click deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kingefman1-cmyk/onchain-safety-scanner-kit)

The button opens Cloudflare's deploy flow for this repository. When it finishes, add your key as the `CAELARA_API_KEY` secret (step 4 below); the site shows an error until it is set. If the button does not suit your account, follow the manual steps.

## Set up in about five minutes

1. Get a key. A free trial key (50 calls, no card) is at https://caelaralabs.com/shield/#trial. Each scan makes **two** calls, so a trial key covers about 25 scans. For more volume, email ops@caelaralabs.com.
2. Install and log in to Cloudflare:
   ```bash
   npm install
   npx wrangler login
   ```
3. Set your brand name in `wrangler.toml` (`NEXT_PUBLIC_BRAND_NAME`).
4. Deploy and add the key as a secret:
   ```bash
   npm run deploy
   npx wrangler pages secret put CAELARA_API_KEY --project-name token-safety-scanner
   ```
5. Open the `*.pages.dev` address Wrangler prints. Add your own domain under Pages > Custom domains.

Local run: copy `.dev.vars.example` to `.dev.vars`, fill in the key, then `npm run dev`.

## What a scan costs

One scan is one composite call (0.025 USDC) plus one atomic call (0.005 USDC), so **0.03 USDC per scan** at the published per-call price. The site has no billing of its own: add a login and payment step in front of `/api/scan` before you charge anyone, and set a Cloudflare rate-limiting rule on `/api/*`. Requests are only accepted from pages served by your own site (see `callerAllowed` in `lib/proxy.js`).

## Endpoints used

| Call | Purpose |
|---|---|
| `GET https://crypto.caelaralabs.com/v1/token-safety-composite` | Safety score, flags, liquidity summary |
| `GET https://crypto.caelaralabs.com/v1/solana-mint-auditor` | Solana mint and freeze authority, supply, extensions, top holders |
| `GET https://crypto.caelaralabs.com/v1/base-erc20-inspector` | ERC-20 name, supply, owner, proxy and risky function selectors |

Chains: Base, Ethereum, Arbitrum, Optimism and Solana. The score is a heuristic screen built from public on-chain data. It is not financial advice, and a low-risk result is not a guarantee.

## Live badge for your users

The page includes an "Embed a live badge" box that generates Markdown and HTML for a public email-authentication badge for your own domain. Each snippet links back to https://caelaralabs.com.

```markdown
[![Domain Trust](https://benchmarks.caelaralabs.com/verify/domain-trust.svg?domain=example.com)](https://caelaralabs.com)
```

```html
<a href="https://caelaralabs.com"><img src="https://benchmarks.caelaralabs.com/verify/domain-trust.svg?domain=example.com" alt="Domain Trust" height="20"></a>
```

The badge needs no key and is cached for an hour. It reports whether SPF and DMARC records are present; it does not validate them.

## Files

```
public/        the page (index.html, app.js, style.css, _headers)
functions/api/ scan.js and config.js (Pages Functions)
lib/proxy.js   input checks, caller check, upstream calls
test/          node --test test/
```

## License

MIT. See `LICENSE`.
