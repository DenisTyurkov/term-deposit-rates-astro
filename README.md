# termdepositrates.co.nz — Astro (static)

NZ term-deposit-rate comparison site. Fully static: a daily scraper writes the
data into a committed SQLite file, Astro prerenders every page at build time, and
Cloudflare Pages serves the static HTML. This is the migration of the original
Rails 8 app — see [`MIGRATION.md`](./MIGRATION.md) for the full rationale and the
old→new mapping.

## How it works

```
db/rates.db          committed SQLite file; the scraper APPENDS rows each run
                     (history preserved via scraped_at). Pages read "latest per
                     bank/term".
scripts/scrape.ts    cheerio scraper for interest.co.nz (regular + PIE paths).
src/lib/rates.ts     build-time query/scoring layer (reads db/rates.db).
src/lib/*            logos, schema (JSON-LD), date/number formatting.
src/pages/*          home, short/long/pie rate pages, calculator, [slug] provider
                     pages. URLs match the old site exactly.
src/components/*     Layout, Nav, Footer, RatesMatrix (+ sort/filter island),
                     SummaryCards, BankLogoStrip, SEO, JsonLd.
src/scripts/*        calculator island (Chart.js).
src/content/*        markdown content collections (pages + providers).
```

## Commands

| Command           | Action                                                        |
| :---------------- | :------------------------------------------------------------ |
| `npm install`     | Install dependencies                                          |
| `npm run scrape`  | Scrape interest.co.nz and append rows to `db/rates.db`        |
| `npm run scrape -- --dry-run` | Scrape and print a summary; write nothing         |
| `npm run dev`     | Local dev server at `localhost:4321`                         |
| `npm run build`   | Prerender the static site to `./dist/`                        |
| `npm run preview` | Serve the built `./dist/` locally                            |

`db/rates.db` **is committed** — the build reads it. Start it from a fresh scrape
with `npm run scrape`.

## Daily flow

1. `.github/workflows/scrape.yml` runs on a cron (~5:30am NZ).
2. It runs `npm run scrape` (appends new rows to `db/rates.db`), verifies the site
   still builds, then commits the updated database.
3. Cloudflare Pages' GitHub integration sees the new commit and rebuilds + deploys.

## Cloudflare Pages setup (one-time)

In the Cloudflare Pages dashboard, connect this GitHub repo and set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Production branch:** the branch the scrape workflow pushes to (e.g. `main`).
- Node version: 22 (set `NODE_VERSION=22` env var if needed).

No secrets are required beyond the GitHub connection — the scrape workflow commits
to the repo with the built-in `GITHUB_TOKEN`, and Cloudflare builds on push.
