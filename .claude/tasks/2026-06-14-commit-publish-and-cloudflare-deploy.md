# Task: Commit migration, publish to GitHub, fix Cloudflare deploy

**Date:** 2026-06-14
**Status:** ✅ Code/deploy config done — awaiting first green Workers build (dashboard-side)

## Context
The full Rails → Astro static migration was already built and verified the day before
(2026-06-13: all 20 pages build, `npm run build` + preview passed) but **nothing was
committed** and there was **no remote**. Today's session took it from an uncommitted
working tree to a published repo with a working deploy configuration.

## What we did

### 1. Committed the migration
- Delegated the commit to a Sonnet subagent via `/commit`.
- Result: commit `48e3651` — `✨ feat: migrate Rails app to Astro static site`.
- 76 files, +8,770 / −332. Working tree clean afterward.

### 2. Branch best-practice: `master` → `main`
- Inspected: no remote, single local branch `master`, only commit was the initial Astro scaffold.
- Renamed `master` → `main` (modern default; Cloudflare/GitHub default production branch).
  - `git branch -m master main` (local-only, reversible).
- `scrape.yml`'s `git push` is branch-agnostic, so no workflow edit was needed.

### 3. Published to GitHub (public, user's account)
- Confirmed `gh` auth: account **DenisTyurkov**, scopes `repo` + `workflow`.
- `gh repo create term-deposit-rates-astro --public --source=. --remote=origin --push`.
- Repo: https://github.com/DenisTyurkov/term-deposit-rates-astro
- `main` pushed and tracking `origin/main`; `main` is the default branch.

### 4. Diagnosed the Cloudflare build failure
First Cloudflare deploy log showed the **static build SUCCEEDED** (20 pages, "Build command
completed"), then a second phase failed:
```
Executing user deploy command: npx wrangler deploy
...
02:10:49 [build] adapter: @astrojs/cloudflare
Error: No such module "dist/server/.prerender/chunks/fs"
```
**Root cause:** the project was created as a **Workers** build (deploy command `npx wrangler
deploy`), not a Pages "Connect to Git" project. With no Cloudflare config present, `wrangler
deploy` auto-ran `astro add cloudflare`, installed the `@astrojs/cloudflare` adapter, and
re-built **with a server adapter**. That tried to run our **build-time** SQLite code
(`better-sqlite3`, `node:fs`) inside the Workers runtime → module not found → exit 1.

The architecture is pure-static: `better-sqlite3` reads `db/rates.db` only at build time.
Nothing of ours should ever run in a Workers runtime.

### 5. Fixed it — assets-only Workers deploy (future-proof)
User noted Cloudflare is folding **Pages into Workers**, so we stayed on the Workers path
instead of recreating a Pages project.
- Added **`wrangler.jsonc`**: an assets-only Worker with `"assets": { "directory": "./dist" }`
  and no `main`. Its presence stops `wrangler deploy` from auto-adding the adapter — it now
  just uploads the prerendered `dist/`.
- Pinned **`wrangler@4`** as a devDependency (reproducible deploys; resolves the config `$schema`).
- Verified locally:
  - `npm run build` → 20 pages, clean.
  - `npx wrangler deploy --dry-run` → "Read 67 files from the assets directory ./dist",
    no adapter, "No bindings found". ✅
- Committed `1f581f2` — `🧑‍💻 chore(deploy): configure Workers static-assets deploy` and
  pushed to `main` to retrigger the Workers build.

## Files created/changed today
- `wrangler.jsonc` (new) — assets-only Worker config pointing at `./dist`.
- `package.json` / `package-lock.json` — added `wrangler@4` devDependency.
- (Plus the initial migration commit `48e3651`, which staged the entire ported tree.)

## Verification results
- `npm run build`: ✅ 20 pages.
- `npx wrangler deploy --dry-run`: ✅ uploads `./dist`, no adapter, no bindings.
- Local working tree clean; `main` pushed to `origin`.

## Open items / next steps (dashboard-side, can't be done from CLI)
1. **Confirm the new Cloudflare Workers build goes green** on commit `1f581f2`.
2. **Worker name match**: `wrangler.jsonc`'s `"name": "term-deposit-rates-astro"` must equal the
   Worker the Git connection created. If different, rename the Worker or update `wrangler.jsonc`.
3. **GitHub Actions write permission**: Settings → Actions → General → Workflow permissions =
   "Read and write" so `scrape.yml` can commit `db/rates.db` back.
4. **Test the daily scrape**: Actions tab → "Daily rate scrape" → Run workflow (`workflow_dispatch`).
5. Optional: add a `src/pages/404.astro` (none exists; Workers static 404 currently falls back).

## Key facts to remember
- **Never add `@astrojs/cloudflare`** — better-sqlite3 is build-time only. Deploy = static assets.
- Cron 17:30 UTC ≈ 5:30am NZT (UTC-only; NZ DST shifts ±1h).
- Repo is public under DenisTyurkov; default branch `main`.
