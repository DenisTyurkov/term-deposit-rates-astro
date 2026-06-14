# SEO Improvement Plan — termdepositrates.co.nz

**Status:** Analysis + plan only. No code changes yet (per CLAUDE.md plan-first workflow).
**Date:** 2026-06-14
**Data sources:** Google Search Console exports —
`Queries.csv` (~1,000 rows, query-level, ~90-day window) **and**
`Pages.csv` (20 rows, page-level — added 2026-06-14, confirms page attribution).

> ✅ **Page-level data now in hand** (`Pages.csv`). The earlier "which page ranks for X is
> inferred" caveat is largely resolved — the duplicate-template gap (§3) is **confirmed**,
> and two findings *changed the plan*: the **homepage ranks pos 21.9** (so fix it, don't
> build a competing `/best/` page) and the **short/long term pages are at pos 65 with 0
> clicks** (fix the dead pages before adding more). Still missing: page×query join,
> backlinks, device/country (see §7).

---

## 1. Executive summary — the 5 moves that matter

| # | Move | Why (evidence) | Upside | Effort |
|---|------|----------------|--------|--------|
| 1 | **Close the sibling-bank ranking gap** (ASB, Westpac, ANZ, Kiwibank, TSB, Rabobank, SBS) | BNZ page ranks **wPos 6.2** and earns **1,208 of the site's 1,498 clicks (81%)**. The *identical-template* sibling pages sit at **wPos 10–12** and earn almost nothing despite huge demand: ASB **27.4k impr → 37 clicks (0.13%)**, Westpac **14.1k impr → 7 clicks (0.05%)**, ANZ **10.8k → 42**. The demand exists; only position is missing. | Very high | L |
| 2 | **Build a "for seniors" segment** (hub + per-bank) | Seniors = **32 queries, 231 clicks, CTR 2.01%, wPos 5.6** — already the **#2 click cluster after raw BNZ rates**, with *no dedicated page*. "bnz term deposit rates for seniors" ranks **pos 3.9**. A real page can own the whole cluster across banks. | High | M |
| 3 | **Rehab the HOMEPAGE to own the head comparison terms** (best / highest / compare / rates nz) | `Pages.csv` shows the **homepage ranks pos 21.9** on 19.4k impressions — it *is* the page targeting "best/highest" (90 queries, wPos 18.7) and "compare" (43 queries, wPos 20.4) and it's losing on page 2–3. Improving an existing ranking page beats building a new one — and a new `/best/` page would cannibalise. | High | M |
| 4 | **Capture "fixed deposit / fixed term" terminology** | "fixed deposit/fixed term" = **66 queries, 8,161 impr, CTR 0.05%, wPos 10.3**. We never use the words "fixed deposit/fixed term" anywhere in content (confirmed: 0 matches in `src/content/`). Includes a Chinese-language cluster (定期存款利率). Pure terminology gap. | Medium-high | S |
| 5 | **Wire FAQPage schema to provider pages + add question content** | Provider markdown bodies already contain full FAQ sections but emit **no `FAQPage` JSON-LD** (only the homepage does). Question queries ("which nz bank…", "what are the current…") = **CTR 2.17%, 21 queries** — answer-engine intent. `faqSchema()` already exists in `src/lib/schema.ts`; it's a wiring job. | Medium | S |

**The one-sentence story:** the site is a single-page success (BNZ) wrapped in a dormant
template. The biggest lever is not new traffic channels — it's getting the 14 other bank
pages and the head comparison terms from page 2 onto page 1, plus capturing the two
segments (seniors, fixed-deposit terminology) that already convert at 2–3× the site
average CTR.

---

## 2. Baseline & key findings

**Totals:** 1,498 clicks / 224,530 impressions / **0.67% sitewide CTR** across ~1,000 queries.

### Traffic concentration (risk + opportunity)
| Bank | Queries | Clicks | Impressions | CTR | wPos |
|------|--------:|-------:|------------:|----:|-----:|
| **BNZ** | 133 | **1,208** | 129,652 | 0.93% | **6.2** |
| ASB | 105 | 37 | 27,435 | 0.13% | 10.0 |
| ANZ | 122 | 42 | 10,820 | 0.39% | 11.0 |
| Westpac | 100 | 7 | 14,094 | 0.05% | 11.8 |
| Kiwibank | 37 | 28 | 5,578 | 0.50% | 10.1 |
| TSB | 41 | 19 | 7,659 | 0.25% | 9.7 |
| Rabobank | 25 | 8 | 5,083 | 0.16% | 11.1 |
| SBS | 29 | 7 | 4,306 | 0.16% | 11.9 |
| Heartland | 20 | 2 | 941 | 0.21% | 15.9 |
| Co-op / ICBC / Baroda / BoC | ~15 | 0 | ~300 | 0% | ~9–12 |

> **81% of all clicks come from one bank.** Diversifying off BNZ is the central strategic goal.

### Page-level performance (`Pages.csv`) — the smoking gun
| Page | Clicks | Impressions | CTR | Position | Read |
|------|-------:|------------:|----:|---------:|------|
| `/bnz` | **1,201** | 131,468 | 0.91% | **6.5** | carries the whole site |
| `/` (homepage) | 166 | 19,444 | 0.85% | **21.9** | head terms stuck on page 2–3 |
| `/asb` | 33 | 26,987 | 0.12% | 9.6 | huge demand, page-1 bottom |
| `/anz` | 28 | 10,243 | 0.27% | 11.2 | page 2 |
| `/kiwibank` | 21 | 5,625 | 0.37% | 10.6 | page 2 |
| `/term-deposit-calculator` | 19 | 5,116 | 0.37% | **15.6** | underperforming |
| `/tsb-bank` | 15 | 7,519 | 0.20% | 9.5 | page-1 bottom |
| `/rabobank` | 6 | 5,351 | 0.11% | 10.3 | page 2 |
| `/westpac` | 5 | 13,854 | 0.04% | 11.5 | 13.8k impr, ~0 clicks |
| `/sbs-bank` | 3 | 3,797 | 0.08% | 10.2 | page 2 |
| `/pie-term-deposit-rates` | 2 | 674 | 0.30% | **41.7** | buried |
| `/heartland-bank` | 1 | 629 | 0.16% | 13.2 | page 2 |
| `/long-term-deposit-rates` | **0** | 3,347 | 0% | **65.1** | ☠️ effectively dead |
| `/short-term-deposit-rates` | **0** | 1,199 | 0% | **65.4** | ☠️ effectively dead |
| `/bank-of-baroda` | 0 | 360 | 0% | 57.5 | buried |
| `/co-operative-bank` | 0 | 335 | 0% | 18.8 | thin |
| `/icbc` | 0 | 68 | 0% | 8.0 | ranks ok, no demand |
| `/bank-of-china` | 0 | 37 | 0% | 8.1 | ranks ok, no demand |
| `/china-construction-bank` | 0 | 6 | 0% | 7.8 | ranks ok, no demand |
| `/bank-of-india` | 0 | 3 | 0% | 24 | negligible |

**Three things this proves:**
1. **Same template, very different positions** (`/bnz` 6.5 vs `/asb` 9.6 vs `/westpac` 11.5)
   → §3's duplicate-content/authority hypothesis is **confirmed**, not inferred.
2. **The homepage is a top opportunity, not a strength** — pos 21.9 on 19.4k impressions.
   It already targets the head "best/compare/rates nz" terms and loses. **Fix the homepage
   instead of building a rival `/best/` page** (which would cannibalise it).
3. **`/short-` and `/long-term-deposit-rates` are at pos ~65 with 0 clicks** despite 4.5k
   impressions and being in the sitemap (priority 0.8). Something is structurally wrong
   (thin + orphaned). **These must be fixed/relaunched before adding more term-length pages**
   — otherwise B3 just clones the failure.

### Segment / intent clusters
| Cluster | Queries | Clicks | Impr | CTR | wPos | Has a page? |
|---------|--------:|-------:|-----:|----:|-----:|-------------|
| **Seniors** | 32 | 231 | 11,493 | **2.01%** | 5.6 | ❌ none |
| Best / highest / top | 90 | 71 | 4,231 | 1.68% | **18.7** | ~homepage only |
| Compare / comparison | 43 | 6 | 1,897 | 0.32% | **20.4** | ~homepage only |
| Calculator | 59 | 57 | 8,171 | 0.70% | **12.6** | ✅ but ranks poorly |
| Fixed deposit / fixed term | 66 | 4 | 8,161 | **0.05%** | 10.3 | ❌ terminology absent |
| PIE | 30 | 4 | 1,207 | 0.33% | **16.4** | ✅ but ranks poorly |
| 6-month | 21 | 26 | 1,739 | 1.50% | 12.4 | ❌ none |
| 12-month / 1-year | 6 | 3 | 125 | 2.40% | 4.2 | ❌ none |
| Business | 7 | 0 | 100 | 0% | 36.8 | ❌ none |
| Question queries | 21 | 22 | 1,015 | **2.17%** | 11.7 | partial (homepage FAQ) |
| "nz"/"new zealand" modifier | 287 | 180 | 27,042 | 0.67% | 14.0 | n/a (modifier) |

### Technical-SEO baseline (what already exists vs. gaps)
**Good:** `@astrojs/sitemap` with per-route priority/changefreq; per-page title+description via
`SEO.astro`; rich JSON-LD library (`Organization`, `WebSite`, `BankOrCreditUnion`,
`CollectionPage`, `ItemList`/`InvestmentOrDeposit`, `BreadcrumbList`, `FAQPage`,
`WebApplication`); provider titles carry a month-year freshness stamp; GTM installed.

**Gaps found:**
- **No `robots.txt`** in `public/` (only `llms.txt`). Sitemap is not advertised to crawlers.
- **`FAQPage` schema only on homepage.** Provider pages render FAQ prose with no schema;
  calculator page has none. `faqSchema()` builder exists and is unused outside home.
- **URL/entity inconsistency.** Build uses directory format → canonical URLs end in `/`
  (e.g. `/bnz/`), but `schema.ts` builds `@id`/`url` without the trailing slash
  (`${ROOT}/${slug}`). Entity `@id`s should be byte-identical to canonicals.
- **No FAQ/answer content** for the high-CTR question cluster on inner pages.
- **Thin internal linking.** Provider pages link only home + sibling logos; no contextual
  links to calculator, term-length, seniors, or PIE pages.
- **Near-duplicate provider bodies** (the 15 `*.md` are structurally identical templates) —
  a thin/duplicate-content risk that likely caps the sibling pages (see §3).

---

## 3. Why does BNZ rank ~p6 while identical sibling pages sit at p10–12?

This is the crux — and `Pages.csv` **confirms it at the page level**: `/bnz` pos 6.5,
`/asb` pos 9.6, `/anz` pos 11.2, `/westpac` pos 11.5, all on the same template. Hypotheses,
split by what we can act on vs. only flag:

**On-page / actionable (do these):**
1. **Content uniqueness.** All 15 provider `.md` bodies are the same skeleton with the bank
   name swapped → Google likely treats them as near-duplicate/thin, suppressing all but the
   one with the strongest external signals (BNZ). **Fix:** make each body genuinely distinct
   (bank-specific rate commentary, product names, term ranges actually offered, credit rating
   context, PIE availability, real differentiators).
2. **Internal-link equity.** BNZ may receive more internal links/anchor variety. **Fix:**
   contextual cross-links + an anchored "compare X vs Y" pattern; ensure every provider is
   linked from high-value hubs (homepage, seniors hub, best/compare pages).
3. **Schema depth & freshness.** Wire `FAQPage` + ensure `dateModified`/entity `@id`
   consistency on every provider page (currently uneven).
4. **Title/meta differentiation.** Sibling titles are formulaic; tune to match observed
   query phrasing per bank (e.g. ASB "for seniors", Westpac "nz", terms offered).

**Off-page / flag only (cannot fix in this repo):**
5. **Backlink authority to the BNZ URL.** The most likely dominant cause of BNZ's edge is
   historical external links/brand association to that specific page. Confirm via a backlink
   tool (Ahrefs/Search Console Links report) and pursue digital-PR/link outreach separately.
6. **Query-volume + brand-affinity effects** in BNZ's favour we can't change.

> **Test to run after changes:** pull a **page-level** GSC export in 4–6 weeks and watch
> ASB/Westpac/ANZ average position. If on-page work moves them from ~10 → ~7 we'll see it;
> if they're stuck, the bottleneck is off-page authority (item 5).

---

## 4. The plan — three tracks

Each action lists: **target queries** (quoted from CSV), **current pos/impr**, **expected
outcome**, **effort (S/M/L)**, **files touched**, and **static-safe?** (must be ✅ — no
runtime server, no Cloudflare adapter, no runtime SQLite).

### TRACK A — Close ranking gaps on existing provider pages (p9–15 → p1–5)

**A1. De-duplicate & deepen the 15 provider bodies.** *(Impact: High · Effort: L · static ✅)*
- Targets: "asb term deposit rates" (15.7k impr, p9.6), "westpac term deposit rates"
  (6.3k, p10.4), "anz term deposit rates" (3.1k, p10.0), "kiwibank term deposit rates"
  (3.0k, p10.0), "tsb term deposit rates" (2.5k, p10.5), "rabobank…" (2.8k, p11.3),
  "sbs term deposit rates" (2.0k, p12.3).
- Files: `src/content/providers/*.md` (rewrite each with unique, bank-specific substance).
- Outcome: lift sibling pages out of duplicate-content suppression toward BNZ's p6 band.
  Even ASB 10→7 on 27k impressions is a large click gain.

**A2. Per-bank title/meta tuning to observed phrasing.** *(High · S · ✅)*
- Targets: include each bank's strongest real modifiers — ASB+seniors ("asb term deposit
  rates for seniors" 1.9k impr p8.1), ANZ+nz, Westpac+nz, "6 months" where banks rank
  (ASB "6 months" 656 impr p7.2).
- Files: `src/pages/[slug].astro` (title/description template — make it data-aware:
  inject top term, "for seniors", min-deposit, or "PIE" when relevant).
- Outcome: CTR + relevance lift on pages already near page 1.

**A3. Wire `FAQPage` + fix entity `@id` consistency on provider pages.** *(Medium · S · ✅)*
- Files: `src/pages/[slug].astro` (add `faqSchema(...)` to its jsonLd array),
  `src/content/providers/*.md` (front-matter FAQ array, or a per-bank FAQ builder in
  `src/lib/`), `src/lib/schema.ts` (normalise `@id`/`url` to trailing slash to match
  canonical from `Layout.astro`).
- Outcome: FAQ rich results + cleaner entity graph → CTR + ranking signal.

**A4. Contextual internal linking from provider pages.** *(Medium · M · ✅)*
- Files: `src/pages/[slug].astro` (add links to calculator, seniors hub, term-length pages,
  PIE page, and 2–3 sibling banks with descriptive anchors).
- Outcome: distributes link equity beyond BNZ; helps A1 lift the laggards.

### TRACK B — New pages & segments

All new routes must be **prerendered**, **kebab-case**, **trailing-slash** URLs, generated
from the existing committed-SQLite data layer (`src/lib/rates.ts`) at build time.

**B1. Seniors hub + per-bank seniors.** *(Impact: High · Effort: M · ✅)*
- Targets (32-query cluster, CTR 2.01%): "term deposit rates for seniors",
  "best term deposit rates nz for seniors", "bnz term deposit rates for seniors" (p3.9),
  "asb term deposit rates for seniors", "anz nz term deposit rates for seniors",
  "kiwibank term deposit rates for seniors".
- Proposed URLs:
  - `/term-deposit-rates-for-seniors/` (hub: matrix + senior-relevant guidance).
  - Optionally `/{slug}/seniors/` *or* a strong "for seniors" section on each provider page
    (decide in implementation; a hub first is the MVP).
- Data: reuse `matrixPageData` (regular rates) + new editorial content. **No new scrape data
  needed** — "seniors" rates are the same products positioned for an audience; do **not**
  invent a senior rate field.
- Internal links: from homepage, every provider page (A4), and footer.
- Risk note: be factually careful — don't imply special senior-only rates that don't exist
  in the data (YMYL; see §6).

**B2. Rehab the HOMEPAGE to own best/highest/compare/"rates nz".** *(High · M · ✅)*
> **Revised after `Pages.csv`:** the homepage already ranks for these terms — at **pos 21.9**.
> So this is a *fix-the-existing-page* job, **not** a new `/best/` page (which would
> cannibalise the homepage, §6). Do not build `/best-term-deposit-rates/` unless the homepage
> demonstrably can't serve both "rates" and "best/compare" intent after rehab.
- Targets: "best term deposit rates nz" (609 impr p13.9), "highest term deposit rates nz",
  "compare term deposit rates nz" (p30), "which nz bank has the best term deposit rates"
  (559 impr p7.7), "term deposit rates nz" (880 impr p15.3).
- Files: `src/pages/index.astro` + `src/content/pages/` (give the homepage real
  comparison/editorial substance: "best per term" + "highest overall" tables derived from
  `matrixPageData`, ranked-by-rate view, a clear `<h1>`/intro using best/compare/highest
  language, FAQ). Tune homepage title/description toward these head terms.
- Outcome: move 19.4k impressions from pos 21.9 toward page 1 — the single highest-ceiling
  page on the site after `/bnz`.

**B3. Fix the DEAD short/long pages first, then add term-length pages.** *(Medium-high · M · ✅)*
> **Revised after `Pages.csv`:** `/short-term-deposit-rates/` and `/long-term-deposit-rates/`
> sit at **pos ~65 with 0 clicks** (4.5k impressions) despite being in the sitemap. Adding
> `/6-month/`, `/12-month/` pages on the same pattern would clone a proven failure. **First
> diagnose & relaunch the two existing pages** (likely thin body + orphaned — no inbound
> internal links; verify indexation in GSC), then expand.
- Phase 1 (fix): rewrite `src/content/pages/{short,long}-term-deposit-rates.md` with unique
  substance; add inbound internal links from homepage + every provider page (ties to C4);
  confirm they're indexed and not duplicating the homepage matrix verbatim.
- Phase 2 (expand, only if Phase 1 recovers): `/6-month-term-deposit-rates/`,
  `/12-month-term-deposit-rates/` via `getStaticPaths()` over distinct `term_length` values.
  Targets: "6 month term deposit rates nz", "best 1 year term deposit rates nz" (p1.5!),
  "term deposit rates nz 6 months". Must interlink with short/long, not cannibalise.

**B4. "Fixed deposit / fixed term" terminology capture.** *(Medium-high · S · ✅)*
- Targets (66 queries, 8.1k impr, 0.05% CTR): "bnz fixed term deposit rates" (4.5k impr
  p5.2 but **0.02% CTR**), "fixed term deposit rates nz", "fixed deposit rates nz",
  "asb fixed term deposit rates", plus Chinese "定期存款利率".
- Approach: **terminology, not new pages.** Add "fixed deposit / fixed term deposit" as
  natural synonyms in titles, H-tags, intro copy, and FAQ across home + provider pages
  ("Term deposits (also called fixed deposits or fixed-term deposits)…"). Files:
  `src/content/**/*.md`, page templates. Consider a short `/fixed-term-deposit-rates/`
  explainer that canonicalises intent if synonyms alone underperform.
- Outcome: convert ~8k near-invisible impressions; capture the non-native-English audience.

**B5. PIE page rehab.** *(Medium · S–M · ✅)*
- Targets: PIE cluster 30 queries, wPos **16.4** despite an existing
  `/pie-term-deposit-rates/`: "asb pie term deposit rates", "westpac pie term deposit rates",
  "bnz pie term deposit rates", "kiwibank pie term deposit rates".
- Approach: strengthen the existing page (unique content, "PIE vs regular term deposit"
  explainer for "pie fund vs term deposit", per-bank PIE callouts, schema), plus internal
  links from provider pages. No new route required.

**B6. (Watchlist, low priority) Business term deposits.** *(Low · M · ✅)*
- Targets: business cluster 7 queries, p36.8, 0 clicks — small but uncontested. Defer until
  A–B above ship; revisit if a page-level export shows latent demand.

### TRACK C — Technical & structured data

**C1. Add `robots.txt`.** *(Medium · S · ✅)*
- File: `public/robots.txt` — allow all, reference
  `Sitemap: https://www.termdepositrates.co.nz/sitemap-index.xml`. (Keep `llms.txt` too.)

**C2. Sitewide `FAQPage` rollout + entity `@id` normalisation.** *(Medium · S · ✅)*
- Files: `src/lib/schema.ts` (trailing-slash `@id`/`url`; helper to assemble per-page FAQ),
  `src/pages/[slug].astro`, `src/pages/term-deposit-calculator.astro`,
  `src/pages/{short,long,pie}-*.astro` (attach `faqSchema`).
- Outcome: consistent entity graph + FAQ rich-result eligibility across the site.

**C3. Freshness signals.** *(Medium · S · ✅)*
- Ensure every page exposes a visible "Last updated {date}" (provider pages already do) and
  emits `dateModified` in schema from `latestScrapeAt`. Confirm `<lastmod>` flows into the
  sitemap. Reinforces the daily-update value prop the cron already delivers.

**C4. Internal-linking architecture.** *(Medium · M · ✅)*
- A consistent cross-link block (component) used by all pages: home ⇄ provider ⇄ seniors ⇄
  best/compare ⇄ term-length ⇄ calculator ⇄ PIE. Files: new `src/components/*` + includes.
- Outcome: spreads equity off BNZ (directly supports A1/§3) and improves crawl/relevance.

**C5. Calculator page ranking lift.** *(Medium · S–M · ✅)*
- Targets: "term deposit calculator" (2.7k impr p10.3), "term deposit calculator nz" (p25.6),
  "bnz term deposits rates calculator" (753 impr p6.6 — currently served by BNZ page, not the
  calculator). Improve calculator page on-page content, add FAQ + `HowTo`/`WebApplication`
  depth, and interlink from provider pages.

**C6. Verify mobile rendering of the rates matrix.** *(Low-medium · S · ✅)*
- The matrix is a wide horizontal-scroll table; confirm CWV/usability on mobile (most NZ
  search is mobile) and that content isn't hidden from indexing.

---

## 5. Prioritised do-first list (Impact × Effort)

| Rank | Action | Track | Impact | Effort | Notes |
|------|--------|-------|--------|--------|-------|
| 1 | A3 + C2 FAQ schema wiring + `@id` fix | A/C | High | S | Cheapest structural win; `faqSchema()` already exists |
| 2 | C1 robots.txt | C | Med | S | 5-minute fix |
| 3 | B4 fixed-deposit terminology | B | Med-High | S | 8k dormant impressions, copy-only |
| 4 | A2 per-bank title/meta tuning | A | High | S | CTR + relevance on page-1-bottom bank pages |
| 5 | **B2 homepage rehab** | B | High | M | Existing page at pos 21.9 on 19.4k impr — biggest ceiling after `/bnz` |
| 6 | B1 seniors hub | B | High | M | #2 click cluster, no page today |
| 7 | A1 de-duplicate provider bodies | A | High | L | The real fix for the sibling gap (now page-confirmed) |
| 8 | **B3 fix dead short/long pages** | B | Med-High | M | Pos 65, 0 clicks — fix before cloning more term pages |
| 9 | A4 + C4 internal linking | A/C | Med | M | Amplifies A1 **and** un-orphans short/long (B3) |
| 10 | B5 PIE rehab + C5 calculator | B/C | Med | S-M | Existing pages at pos 41.7 / 15.6 |
| 11 | C3 freshness, C6 mobile | C | Low-Med | S | Polish |
| 12 | B6 business (watchlist) | B | Low | M | Defer |

**Suggested sequencing:** ship the S-effort cluster first (1–4) as one batch → measure CTR
in GSC → then the M/L existing-page rehabs (5, 8, 10 — fixing pages that already rank is
lower-risk/faster than net-new) and the high-impact content builds (6, 7) → then polish
(9, 11, 12). The page-level export needed to confirm the §3 hypothesis is now **in hand**.

---

## 6. Risks & guardrails

- **Thin/duplicate content (biggest risk).** New term-length / seniors / best pages are
  template-generated from the same rate table → must carry **genuinely unique copy**, or we
  add more duplicate pages and worsen §3. Every generated page needs distinct editorial body.
- **Cannibalisation.** Watch overlaps: homepage vs `/best-term-deposit-rates/`; new
  term-length pages vs existing `/short-` & `/long-term-deposit-rates/`; `/best-` vs
  `/compare-`. Pick one canonical target per intent and interlink; don't split equity.
- **YMYL / E-E-A-T (financial content).** Rates and tax/senior claims must be accurate,
  dated, and sourced. Don't imply senior-only or guaranteed rates that aren't in the data.
  Keep author/publisher and "last updated" signals strong. This is regulated-adjacent.
- **Over-templating.** Resist auto-spinning every bank×term×segment combination — that's a
  doorway-page pattern Google penalises. Build hubs + the segments with proven demand only.
- **Static-architecture invariant.** Every item above is build-time/static-safe. Do **not**
  add the Cloudflare adapter or runtime SQLite to serve any new page (CLAUDE.md / MIGRATION.md).
- **BNZ dependency.** 81% of clicks ride one page; protect it (no risky title experiments on
  BNZ) while diversifying.

---

## 7. Data I still need (to confirm / target better)

1. ✅ ~~Page-level GSC export~~ — **received** (`Pages.csv`); confirmed §3 and reshaped B2/B3.
   Still useful: a **Pages × Queries** join to see exactly which queries each URL wins.
2. **GSC "Links" report or a backlink tool** — to test whether BNZ's edge is backlinks
   (§3 item 5), which would mean on-page work alone won't fully close the gap.
3. **Device & country split** — to size the mobile-first and non-native-English
   (fixed-deposit / Chinese-query) audiences.
4. **Date-range comparison (last 3 mo vs prior)** — to see trajectory and seasonality of the
   rate-shopping cycle before committing to term-length pages.
5. **Top-pages CTR by position** — to calibrate the CTR-curve assumptions used for upside
   estimates (currently industry-standard curve, not site-specific).

---

## 8a. IMPLEMENTATION LOG — 2026-06-14 (executed: "do it all")

All tracks implemented except the deliberately-skipped `/best/` page (B2 was
re-scoped to homepage rehab to avoid cannibalisation) and B6 business (watchlist).
Build green: **23 pages** (was 20; +seniors, +6-month, +12-month). `npm run build`
passes; FAQ/ItemList JSON-LD verified per page; robots.txt in `dist`; canonical now
matches schema `@id` (both trailing-slash).

**New files**
- `public/robots.txt` (C1) — allows all, points to `sitemap-index.xml`.
- `src/lib/faq.ts` (A3/C2) — single source of truth for FAQ content (provider,
  seniors, short, long, term-length, calculator, pie). Rendered visibly *and* fed to
  `faqSchema()` so JSON-LD matches on-page text.
- `src/components/Faq.astro` (A3/C2) — visible FAQ block.
- `src/components/RelatedLinks.astro` (A4/C4) — internal-linking hub block.
- `src/pages/term-deposit-rates-for-seniors.astro` (B1) — seniors hub.
- `src/pages/6-month-term-deposit-rates.astro`, `src/pages/12-month-term-deposit-rates.astro` (B3 phase 2).

**Modified files**
- `src/lib/schema.ts` (C2) — trailing-slash `@id`/`url` in `bankOrganizationSchema`
  and `investmentProductSchema` provider `@id`.
- `src/pages/[slug].astro` (A2/A3/A4/B4) — keyword+rate-aware title ("up to X%, fixed
  deposit"), fixed-deposit synonym + calculator/home links in intro, `faqSchema` +
  visible `<Faq>` from `providerFaqItems`, `<RelatedLinks>`, trailing-slash `pageUrl`.
- `src/pages/index.astro` (B2/B4) — title/H1/description retargeted to
  best/highest/compare + "fixed deposit"; `<RelatedLinks>`.
- `src/pages/term-deposit-calculator.astro` (C5) — new title, `faqSchema`+`<Faq>`,
  `<RelatedLinks>`, trailing-slash url.
- `src/pages/short-term-deposit-rates.astro`, `long-term-deposit-rates.astro` (B3/A2) —
  "Best …" titles, `faqSchema`+`<Faq>`, `<RelatedLinks>`, trailing-slash urls.
- `src/pages/pie-term-deposit-rates.astro` (B5) — descriptive title/description,
  `faqSchema` (matches existing visible FAQ), `<RelatedLinks>`, trailing-slash url.
- `src/components/Nav.astro`, `Footer.astro` (C4) — added Seniors / 6-month /
  12-month / PIE links to un-orphan pages (directly addresses the pos-65 short/long).
- `src/content/providers/*.md` ×15 (A1) — **fully rewritten, unique per bank**
  (~640 words each), FAQ sections removed (now from `faq.ts`), fixed-deposit synonym +
  seniors/calculator/home links added. Verified: no fabricated rates/$/ratings; each
  has a distinct bank-specific narrative (Kiwibank local-owned, Heartland digital +
  seniors, Rabobank agribusiness, SBS mutual, TSB community-trust, etc.).

**Not done (by design)** — `/best-term-deposit-rates` page (homepage rehab instead);
B6 business page (watchlist); short/long `.md` bodies left as-is (already 1,300–1,600
words — their problem was orphaning + weak titles, now fixed structurally, not length).

**Still pending (off-page / needs data):** backlink check for the BNZ-vs-siblings gap
(§3 item 5), Pages×Queries join, and a post-deploy GSC re-pull in 4–6 weeks to measure
whether the sibling pages move off page 2.

## 8. Verification approach (for the implementation phase that follows)

Per CLAUDE.md — no code yet. When implementation is approved, each change verifies via:
- `npm run build` (must still produce all pages, +N new routes, no errors).
- `npm run preview` — spot-check affected pages render + new internal links resolve.
- Validate JSON-LD (Google Rich Results Test) for FAQ/ItemList/Breadcrumb on changed pages.
- `npx wrangler deploy --dry-run` only if deploy/config touched (none planned in Track A/B).
- Confirm `robots.txt` + `sitemap-index.xml` resolve in the built `dist/`.
- Re-pull GSC (page-level) 4–6 weeks post-deploy to measure position/CTR movement.
