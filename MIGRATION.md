# Migration Plan: Rails → Astro

This document captures the agreed architecture for migrating this Rails 8 app to a
new, fully static Astro project. It exists so the context survives even if the new
project is started fresh later.

## Why migrate

This site is read-only for visitors and its data changes only **once per day** (a
scraper). Today every request boots Ruby, queries SQLite, and recomputes value scores
to render HTML that is identical for 24 hours. That's the textbook case for a static
site generator: prerender once per scrape, serve static files the rest of the day.

**Gains:** free/near-free static hosting, no 24/7 server or Litestream to maintain,
faster TTFB, better Core Web Vitals, markdown becomes a typed content layer.

**The one thing we lose:** the Turbo Stream live-push in `ScrapeRatesJob`. Irrelevant —
data only changes at 5:30am, so a daily rebuild gives visitors identical fresh numbers.

## Architecture decisions (locked in)

1. **Static site.** Astro with `output: 'static'`. Every page prerendered at build.
2. **Database = a committed SQLite file** (e.g. `db/rates.db`) read at build time with
   `better-sqlite3`. **Not** a cloud DB.
   - We keep full rate history: the scraper **appends** rows with a `scraped_at`
     timestamp, exactly like the Rails app does now.
   - Pages read "latest rate per bank/term" — port that query logic.
   - Caveat: git re-stores the whole binary file each commit, so a daily-growing DB
     slowly bloats the repo. Fine for years at our scale (a few hundred rows/day).
     That's the signal to graduate to a hosted DB if it ever matters.
3. **Scraper rewritten in TypeScript using `cheerio`** (replaces Nokogiri). Preserve:
   column-index maps, bank-name normalization, parent/variant extraction, minimum-
   deposit parsing, and both the regular + PIE scraping paths. Writes into the SQLite
   file using the same unique key (`bank_name + term_length + rate_type`).
4. **Daily updates = GitHub Actions cron** (replaces `whenever`/cron + the Turbo Stream
   broadcast). On a schedule: run scraper → update `db/rates.db` → commit the file →
   that triggers a rebuild + deploy.
5. **Hosting = Cloudflare Pages.**
6. **Markdown → Astro Content Collections** (typed). Replaces `File.read` + Kramdown.
7. **Interactivity = Astro islands.** The calculator and table sort/filter become
   client-side islands, reusing the existing JS nearly verbatim.

## Data layer ladder (no lock-in)

Every rung speaks SQLite, so "graduating" is a config swap, not a rewrite:

```
File SQLite  →  Turso / Cloudflare D1 (cloud SQLite)  →  full server + SQLite/Postgres
   (free)              (free tier)                          (only when truly needed)
```

Start at the file. Climb a rung only when a feature demands it (see below).

## When to change the data layer

Most expansion stays static and free:

| If you add…                                  | Needs                                  | Stay static? |
|----------------------------------------------|----------------------------------------|--------------|
| More banks, terms, rate types, pages         | Just more data/content                 | yes          |
| Rate history charts / trends                 | Already covered by the SQLite file      | yes          |
| More countries / sister sites                | More builds                            | yes          |
| Scrape more often (hourly)                    | Change the cron timer                   | yes          |
| Public API for the rate data                 | Runtime queries → Cloudflare D1 + Workers | + one dynamic route |
| Live search / filtering over big dataset     | Runtime query per request               | + one dynamic route |
| Email alerts ("tell me when ASB hits 6%")    | Scheduled compare + send job            | + a small worker |
| User accounts / saved lists / reviews        | Auth + visitor-written DB → real backend | the real jump |

The **one** fundamental fork is letting visitors **write** data (accounts, comments).
That's when "bake once a day" stops being enough — and when Cloudflare D1 + Workers
pays off, since hosting is already on Cloudflare.

## Old → new mapping

| Today (Rails)                                   | In Astro                                            |
|-------------------------------------------------|-----------------------------------------------------|
| `Scrapers::InterestCoNz` (Nokogiri)             | `scripts/scrape.ts` (cheerio)                       |
| SQLite + Litestream + ActiveRecord              | committed `db/rates.db`, read via `better-sqlite3`  |
| `RatesController` scoring/matrix/cards logic    | `src/lib/rates.ts` (plain TS port)                  |
| `content/providers/*.md`, `content/pages/*.md`  | Astro Content Collections (`src/content/`)          |
| ERB views + partials                            | `.astro` components                                 |
| `term_deposit_calculator_controller.js`         | Astro island (`client:visible`)                     |
| `rates_table_controller.js`                     | Astro island (`client:idle`)                        |
| `meta-tags` gem                                 | `<SEO>` component / `astro-seo`                      |
| `SchemaMarkup` concern (JSON-LD)                | inline `<script type="application/ld+json">`        |
| `seo#sitemap` builder                           | `@astrojs/sitemap`                                  |
| `seo#llms_txt` + `llms.txt`                     | static file in `public/` (or tiny endpoint)         |
| `/:slug` provider route                         | `src/pages/[slug].astro` + `getStaticPaths()`       |
| `whenever` cron + Fly.io                        | GitHub Actions `schedule:` cron                     |
| `ScrapeRatesJob` Turbo broadcast                | deleted — replaced by rebuild-on-scrape             |

### Pages / URLs (keep identical)

`/` (home rate matrix), `/short-term-deposit-rates`, `/long-term-deposit-rates`,
`/pie-term-deposit-rates`, `/term-deposit-calculator`, `/:slug` (provider pages),
`/sitemap.xml`, `/llms.txt`.

### Controller logic to port to `src/lib/rates.ts`

`calculate_best_rates`, `calculate_value_score`, `generate_summary_cards`,
`create_rates_matrix`, `sort_terms`, `term_in_months`.

## Build order

1. Read the source Rails project; produce a file-by-file plan; get approval.
2. **Port the scraper first** (highest risk) and prove it extracts correct data into
   the SQLite file before building any pages.
3. Data/query layer (`src/lib/rates.ts`).
4. Pages (keep URLs + visual output matching the live site).
5. Interactive islands (calculator, table sort/filter).
6. SEO (meta tags, sitemap, JSON-LD, llms.txt).
7. GitHub Action (scrape → commit db → rebuild → deploy).

## Daily flow (after migration)

```
5:30am  GitHub Actions cron triggers scrape.ts (cheerio)
        → reads interest.co.nz
        → APPENDS new rows into db/rates.db (keeps history)
        → commits the file
5:31am  Astro build reads db/rates.db + content collections
        → prerenders all pages
        → deploys static HTML to Cloudflare Pages
all day visitors get freshly-baked static pages; nothing is "running"
```

## Honest trade-offs

- **Effort:** ~3–5 focused days. Small app: ~5 page types, ~500 lines of JS, ~600
  lines of controller logic, one scraper.
- **Hardest part:** re-verifying cheerio selectors against interest.co.nz's live HTML
  (port the Nokogiri fallbacks like `table ||= doc.xpath("//table").first`).
- **What you give up:** `rails console` live data fixes. A correction now means a
  re-scrape/rebuild (minutes), not a live DB edit.
- **Don't do** a half-migration (Rails alive just for the DB/scraper while Astro
  renders the frontend) — two systems to maintain for an app this size. Go fully
  static or stay on Rails.
