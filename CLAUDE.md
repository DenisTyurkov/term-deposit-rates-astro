You are an expert in Astro, TypeScript, static site generation, SQLite (better-sqlite3),
Cheerio scraping, Tailwind CSS, and Cloudflare Workers static-asset hosting.

This project is a **fully static** Astro port of a Rails 8 app (`termdepositrates.co.nz`).
It scrapes NZ term-deposit rates once a day, stores them in a committed SQLite file, and
prerenders every page at build time. There is **no server at runtime** — visitors get
plain static HTML. See `MIGRATION.md` for the full architecture and the locked decisions.

## Plan & Review

### ⚠️ MANDATORY WORKFLOW - NO EXCEPTIONS

#### Before starting ANY non-trivial work:
1. **ALWAYS use ExitPlanMode tool first** — present your plan for approval.
2. **IMMEDIATELY after approval**: write the detailed plan to `.claude/tasks/TASK_NAME.md`.
3. **WAIT for explicit user confirmation** before any implementation.
4. **NO CODE CHANGES** until the plan is written and approved.

#### Plan Requirements:
- Detailed implementation steps with reasoning.
- Data-layer changes (`db/schema.sql`, scraper writes, query-layer reads in `src/lib/rates.ts`).
- Files to be created/modified, with the specific change in each.
- Verification approach (`npm run build`, `npm run preview`, `wrangler deploy --dry-run`).
- Astro-specific considerations (static routes / `getStaticPaths`, content collections, islands, SEO).
- Research external knowledge if needed (use the Task tool / Astro docs MCP).
- Keep it MVP-focused; avoid over-engineering. Match the live Rails site's URLs and output.

#### While implementing:
- **Update `.claude/tasks/TASK_NAME.md` after each major step.**
- **Append detailed change descriptions** for engineer handoff.
- **Document any deviations** from the original plan (this project already carries several
  deliberate divergences from a 1:1 Rails port — see `MIGRATION.md` / memory).
- **Record actual file paths and line numbers changed.**

## Architecture (how the pieces fit)

```
scripts/scrape.ts   cheerio scraper → APPENDS rows into db/rates.db (stamped scraped_at)
db/rates.db         committed SQLite file; the single source of rate data
db/schema.sql       table definition
src/lib/rates.ts    plain-TS port of the Rails controller logic (read "latest per bank/term",
                    value scoring, matrix builder, summary cards, calculator data)
src/lib/logos.ts    bank-name → imported logo asset map
src/lib/format.ts   number/currency/term formatting helpers
src/lib/schema.ts   JSON-LD builders
src/content/        Astro Content Collections — providers/*.md and pages/*.md (pure markdown bodies)
src/pages/*.astro   prerendered routes; [slug].astro uses getStaticPaths() for provider pages
src/components/     .astro presentation components
src/scripts/calculator.ts   the one client island (term-deposit calculator)
.github/workflows/scrape.yml  daily cron: scrape → build → commit db → push
wrangler.jsonc      assets-only Worker: uploads ./dist; NO Astro adapter
```

### Critical invariant — better-sqlite3 is BUILD-TIME ONLY
`better-sqlite3` (and `node:fs`/`node:path`) run **only during `astro build`** on Node to read
`db/rates.db`. They must **never** enter a runtime bundle. This is why `output: 'static'` and why
we deploy via an assets-only `wrangler.jsonc` rather than `@astrojs/cloudflare`. **Do not add the
Cloudflare adapter** — it pulls build-time code into the Workers runtime and the build fails on
`No such module "fs"`. If a feature genuinely needs runtime queries, that's a Cloudflare D1/Workers
decision to raise explicitly, not an adapter add (see the data-layer ladder in `MIGRATION.md`).

## Code Style and Structure
- Write concise, idiomatic, strongly-typed TypeScript. Prefer `type`/interfaces over `any`.
- Keep `.astro` components presentational; keep data/query/scoring logic in `src/lib/`.
- Prefer iteration and small pure functions over duplication.
- Use descriptive names (e.g. `latestRates`, `calculateValueScore`).
- Match the surrounding code's idioms, comment density, and naming — read a neighbour first.

## Naming Conventions
- `kebab-case` for content files and provider slugs (`bank-of-baroda.md`), matching URLs.
- `camelCase` for variables/functions, `PascalCase` for types and `.astro` components.

## Data layer
- **Append-history model**: each scrape INSERTs new rows stamped with one `scraped_at` per run.
  Pages read **latest row per bank/term** (matrix pages use per-(bank,term) MAX; the calculator
  uses the single global MAX). Replicate each read faithfully — they differ on purpose.
- Bank-facing pages filter `rate_type='regular'`; the PIE page filters `'pie'`.
- `min_deposit` is stored in cents (×100), matching the Rails scraper.
- Preserve the known quirks documented in memory / `MIGRATION.md` (SBS `"SBS Bank."` trailing dot,
  variant→parent slug linking, trailing-slash URLs, calculator `convertTermToYears` kept verbatim).

## UI and Styling
- Tailwind CSS (config in `tailwind.config.mjs`, `@tailwindcss/typography` for markdown bodies).
- Responsive, accessible markup. Keep client JS to the single calculator island — everything else
  is static HTML. Do not reach for a framework or hydration where static output suffices.

## Error Handling
- Fail the **build** loudly on bad/missing data rather than shipping a broken page.
- The scraper preserves Nokogiri-style table-finding fallbacks; keep them when editing selectors.

## Testing & Verification

There is no unit-test framework yet. Verification is build + preview + deploy dry-run.

### After Implementation:
- **ALWAYS build**: `npm run build` (must produce all 20 pages with no errors).
- **Preview**: `npm run preview` and check the affected pages render correctly.
- **Scraper changes**: `npm run scrape -- --dry-run` (prints a summary, writes nothing) before a
  real `npm run scrape`. Re-verify cheerio selectors against live interest.co.nz HTML.
- **Deploy config changes**: `npx wrangler deploy --dry-run` (must read files from `./dist`, list
  no adapter/bindings).
- **Update the plan/task file** with verification results.

## Commands
- `npm run dev` — local dev server.
- `npm run build` — prerender all pages into `dist/`.
- `npm run preview` — serve the built `dist/`.
- `npm run scrape` / `npm run scrape -- --dry-run` — run the scraper (writes / inspects `db/rates.db`).
- `npx wrangler deploy --dry-run` — validate the static-assets deploy without uploading.

## Deploy
- **Hosting**: Cloudflare Workers static assets (Pages is being folded into Workers). The
  `wrangler.jsonc` `assets.directory` points at `./dist`; `wrangler deploy` just uploads it.
- **Pipeline**: GitHub Actions cron (`.github/workflows/scrape.yml`, 17:30 UTC ≈ 5:30am NZT) →
  scrape → build → commit `db/rates.db` → push to `main` → Cloudflare auto-builds & deploys.
- The Worker `name` in `wrangler.jsonc` must match the Worker created by the Git connection.

## Security
- Never commit secrets. `.env*` and credentials are out of scope for this static site.
- The scraper hits a third-party site (interest.co.nz) — be a good citizen: one run/day, no retries
  hammering. Don't add scraping of anything we don't already pull.

## Workflow Enforcement

### Pre-Implementation Checklist:
- [ ] Plan written to `.claude/tasks/TASK_NAME.md`
- [ ] User explicitly approved the written plan
- [ ] Data-layer impact assessed (schema / scraper / query reads)
- [ ] Static-route / content-collection impact planned
- [ ] Verification strategy defined

### During Implementation Checklist:
- [ ] Plan file updated with progress
- [ ] Each change documented with file paths + line numbers
- [ ] Astro conventions followed; logic kept in `src/lib/`, not `.astro`
- [ ] No Cloudflare adapter / no runtime use of better-sqlite3

### Post-Implementation Checklist:
- [ ] `npm run build` passes (all 20 pages)
- [ ] `npm run preview` manually verified
- [ ] `npx wrangler deploy --dry-run` clean (when deploy/config touched)
- [ ] Plan/task file updated with final results
- [ ] No regressions vs the live site's URLs/output
