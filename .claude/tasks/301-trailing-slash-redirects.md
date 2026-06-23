# 301 redirect for no-slash → trailing-slash URLs

## Problem
After the Rails→Astro migration, GSC shows both `/heartland-bank` (legacy Rails URL,
indexed for years) and `/heartland-bank/` (new Astro directory-format URL) as duplicates.

Diagnosis (verified against live site 2026-06-24):
- `/heartland-bank/` → `200`, self-referential `rel=canonical` to the slash form. ✅
- `/heartland-bank`  → **`307 Temporary`** → `/heartland-bank/`. ⚠️ root cause
- Sitemap + internal links + canonical + JSON-LD `@id` → all trailing-slash. ✅

The site already canonicalises on the trailing-slash form. The only weak signal is the
**307** (temporary) redirect, which tells Google to keep the old no-slash URL alive.

## Decision
Keep trailing-slash (locked migration decision; everything already points to it).
Upgrade the no-slash→slash redirect from 307 → **301 Permanent** so Google drops the
legacy duplicates and transfers ranking signal to the canonical slash URLs.

## Implementation
Cloudflare static-assets `html_handling` only emits 307 and can't be set to 301.
The lever is a `dist/_redirects` file with explicit per-route `301` rules. Generated
(not hand-written) to avoid slug drift and to avoid the splat redirect-loop
(`/* /:splat/ 301` also matches the already-slashed URL → loop).

### Change: astro.config.mjs
Inline integration with an `astro:build:done` hook:
- `pages` gives every built route (`heartland-bank/`, `short-term-deposit-rates/`, …).
- For each pathname ending in `/` and not root, emit `/<no-slash> /<with-slash> 301`.
- Write to `<dir>/_redirects` via node:fs/node:path (build-time only — consistent with
  the better-sqlite3 build-time-only invariant; nothing enters a runtime bundle).

### wrangler.jsonc
No change unless testing shows html_handling's 307 shadows the `_redirects` 301
(then set `assets.html_handling`). `_redirects` is evaluated before auto html_handling.

## Verification
- [ ] `npm run build` — all pages emit + `dist/_redirects` has one 301 line per page.
- [ ] `npm run preview` — provider page renders unchanged.
- [ ] `npx wrangler deploy --dry-run` — clean, reads ./dist, no adapter/bindings.
- [ ] Post-deploy: `curl -sI /heartland-bank` → `301`.
- [ ] GSC: Validate Fix on the no-slash URLs (slow convergence, days–weeks).

## Out of scope
No no-slash switch, no canonical/sitemap edits (already correct), no Cloudflare adapter.

## Progress log
- Implemented `trailingSlashRedirects()` inline integration in `astro.config.mjs`
  (astro.config.mjs:9-50), registered in `integrations` (astro.config.mjs:91).
- `npm run build` ✅ — 23 pages built; `dist/_redirects` generated with 22 rules
  (root `/` excluded; all 15 providers + 7 static pages covered).
- `npx wrangler deploy --dry-run` ✅ — reads ./dist, "No bindings found", no adapter.
- Preview note: `astro preview` does NOT process `_redirects` (Cloudflare-only), so the
  301 itself is verified post-deploy, not in local preview.

## Remaining (post-deploy, user)
- Deploy: commit + push `main` → Cloudflare auto-build.
- Verify: `curl -sI https://www.termdepositrates.co.nz/heartland-bank` → expect `301`.
- If still `307`: Cloudflare's auto html_handling is shadowing `_redirects`; fall back to
  setting `"html_handling": "force-trailing-slash"` in wrangler.jsonc assets block.
- GSC: URL Inspection → Validate Fix on no-slash URLs (convergence takes days–weeks).
