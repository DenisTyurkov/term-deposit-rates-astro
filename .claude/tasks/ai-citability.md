# Task: AI-answer-engine citability restructure

## Goal
Make every rate claim extractable as a self-contained sentence pairing **claim + date + named entity**, rendered as real server-side HTML (no JS injection, not inside table cells), so Claude/ChatGPT/Perplexity/AI Overviews can quote us. Motivated by losing a citation to Opes Partners, whose winning pattern was explicit standalone sentences (e.g. "As at [date], the highest 12-month term deposit rate is 3.95%, offered by Rabobank") rather than a rate table wrapped in generic prose.

## Locked decisions
- Aggregated "all term-length leaders" list lives on the **homepage** (user chose this over a new `/best-term-deposit-rates` route). Homepage is the canonical citable summary.
- No DB/schema/scraper changes. Pure additive query functions + one presentational component.
- Real HTML `<ul><li>` text, placed high on the page, not hydrated, not inside table cells.

## DB reality (verified)
Distinct regular term strings: `1 month, 3 months, 4 months, 5 months, 6 months, 9 months, 12 mths, 18 mths, 2 years, 3 years, 4 years, 5 years`.
Note: 12-month is stored as `"12 mths"` (not `"12 months"`), 18-month as `"18 mths"`.
Ties are common — 18 mths currently ties 10 banks at 4.00%. Sentence generator must handle ties.

## Implementation steps

### 1. `src/lib/rates.ts` — new pure functions
- `termLabel(term)`: via `termInMonths()`; `<24 → "N-month"`, else `"N-year"`.
- `TermLeader` interface + `termLeaders(rates, asOfIso)`: per-term max rate, all leader banks (cleaned), full sentence. Tie handling 1/2/3/>3.
- `bankLeaderSummary(data, asOfIso)`: bank headline sentence + national-lead sentences.

### 2. `src/components/RateSummary.astro`
Crawlable block: "Rates last updated: {date}" + heading + `<ul>` of leader sentences. Props: `leaders`, `latestScrapeAt`, `heading`, optional `bankLines`.

### 3. Homepage `src/pages/index.astro`
`termLeaders(data.rates, ...)` (all terms) → `<RateSummary>` after hero, before `<SummaryCards>`.

### 4. Rate pages: short/long/6-month/12-month/seniors/pie
Same insertion, each scoped to its own `data.rates`.

### 5. Bank pages `src/pages/[slug].astro`
Bank summary block directly under H1, above tables. Filler markdown already below tables.

### 6. Audit "last updated" near top — delivered via RateSummary on every rates page.

## Verification
- `npm run build` (all pages, no errors)
- `npm run preview` + view-source: sentences in HTML, ties render, not JS-injected.

## Progress log
- Plan approved (homepage as summary page).
- `src/lib/rates.ts`: added `termLabel`, `joinBanks` (tie handling 1/2/3/>3), `TermLeader` + `termLeaders()`, `BankLeaderSummary` + `bankLeaderSummary()` (national leads detected by rate-per-term value match, robust to parent/variant names). Imported `pct`, `dayMonthYear` from `./format`.
- `src/components/RateSummary.astro`: new crawlable block (real `<ul><li>`, not hydrated) — heading + "Rates last updated" + sentences. Props: `heading`, `latestScrapeAt`, `leaders`, `bankLines`, `intro`.
- Homepage `index.astro`: full 12-term leader list inserted after hero, before SummaryCards.
- `short-term`, `long-term`, `term-deposit-rates-for-seniors`, `pie-term-deposit-rates`, `6-month`, `12-month`: RateSummary added (each scoped to its own `data.rates`).
- Bank pages `[slug].astro`: bank summary block (headline + national leads) inserted directly under the hero, above the rate tables. Filler markdown already sat below tables.

## Verification results
- `npm run build`: PASS — 23 pages, no errors.
- Static HTML (dist/) confirmed via grep: all 12 homepage sentences present as raw text (not JS-injected); ties render ("Bank of China and Rabobank", "ASB, BNZ, Bank of China and 7 other banks"); "SBS Bank" cleaned (no trailing dot). Long-term page scoped to 18mo–5yr; 12-month page single sentence.
- DOM order (byte offsets) on sbs-bank: H1 673 < summary 9320 < first table 25306 → summary leads, above table.
- Preview visual check: homepage + SBS bank page render cleanly with "Rates last updated: 24 June 2026" near top.
- No DB/schema/scraper changes; no Cloudflare adapter. Invariants preserved.

## Notes / out of scope
- Pre-existing `SummaryCards` and provider table title still show "SBS Bank." with trailing dot (existing quirk); RateSummary uses cleaned names. Left as-is.
- No JSON-LD added (item 5 satisfied by real HTML). Can add a structured-data mirror later if wanted.
