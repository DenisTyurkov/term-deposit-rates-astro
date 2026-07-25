# Lead-capture quiz: `/best-rate-finder` on termdepositrates.co.nz → nz-leads MongoDB

## Context

termdepositrates.co.nz currently captures no leads. We're adding a multi-step lead-capture quiz (modelled on `unlimitedbroadband.co.nz/broadband-quiz`) that asks 4 questions, collects name + email + phone, and rewards submission with personalized best-rate results. Leads are stored in the existing nz-leads MongoDB `visitors` collection via the proven cross-site intake endpoint `POST https://www.broadband.co.nz/api/leads/intake`.

**Decisions made with Denis (2026-07-25):** multi-step quiz · questions: deposit amount, term length, current bank, goal/timing · contact: name + email + phone · reward: personalized rates shown client-side after submit · no BothBrains/Make distribution (campaign `leads-reporting: disabled` — downstream is broadband-specific) · **term-deposit leads sync to ActiveCampaign** server-side after storage · URL: **`/best-rate-finder`**.

**Key constraint:** the Astro site is fully static (no server runtime), so the browser POSTs directly to the intake endpoint — the endpoint's CORS allowlist must include this site's origins. `PUBLIC_*` env vars are inlined into the client bundle at build time (world-readable), so only the endpoint URL lives in the Astro site; the ActiveCampaign API key stays server-side in nz-leads.

**ActiveCampaign state in nz-leads:** `src/lib/activecampaign.ts` exists (`newContact()`: create contact → subscribe list → tag; account `wisecontent1`, defaults list 4 / tag 7) but is currently **called by nothing** — this wiring is its first live use. It also has a latent bug: the `listId`/`tagId` parameters are accepted but ignored — lines 96/114 use the hardcoded `LIST_ID`/`TAG_ID` constants.

**Blocking prerequisite found in exploration:** the intake route is hardcoded single-tenant — `DEFAULT_UTM_SOURCE = 'unlimitedbroadband.co.nz'` and `campaignId = process.env.UNLIMITEDBB_CAMPAIGN_ID` (`nz-leads/src/app/api/leads/intake/route.ts:25,126`). Without Phase 1, every term-deposit lead would be attributed to the unlimitedbroadband campaign.

**Reference doc (read it before implementing):** `/Users/denist/Documents/Projects/unlimitedbroadband.co.nz/.claude/tasks/20260722120000_implement_nzleads_integration.md` — the prior integration's full history, deviations, and traps.

**Repos touched:** this repo (Astro) + `/Users/denist/Documents/Projects/nz-leads` (Next.js 15 + Payload v3, pnpm; production deploys from the **`prod`** branch — pushing `master` only builds SSO-protected preprod).

---

## Phase 1 — nz-leads: multi-tenant intake + ActiveCampaign sync

### Code (two files)

**Modify `nz-leads/src/app/api/leads/intake/route.ts`:**
- Add an origin→site config map (origin is already validated by the CORS allowlist, so it's the trustworthy tenant key):
  ```ts
  const SITE_CONFIGS: Record<string, { utmSource: string; campaignIdEnv: string; activeCampaign?: { listIdEnv: string; tagIdEnv: string } }> = {
    'unlimitedbroadband.co.nz': { utmSource: 'unlimitedbroadband.co.nz', campaignIdEnv: 'UNLIMITEDBB_CAMPAIGN_ID' },
    'termdepositrates.co.nz':   { utmSource: 'termdepositrates.co.nz',   campaignIdEnv: 'TERMDEPOSIT_CAMPAIGN_ID',
                                  activeCampaign: { listIdEnv: 'TERMDEPOSIT_AC_LIST_ID', tagIdEnv: 'TERMDEPOSIT_AC_TAG_ID' } },
  }
  ```
- Resolve by the request's Origin hostname with `www.` stripped. `localhost` origins (dev) resolve via an optional `site` body field (`'termdepositrates'` etc.), defaulting to unlimitedbroadband for backwards compatibility.
- Replace the two hardcoded uses (`DEFAULT_UTM_SOURCE`, `UNLIMITEDBB_CAMPAIGN_ID`) with the resolved config. Keep the existing `flag: no_campaign` + log-error behavior when the env var is unset.
- **After `newLead()` succeeds**, if the site config has `activeCampaign`: call `newContact()` from `src/lib/activecampaign.ts` with the lead's email/name/phone and the env-configured list/tag IDs — **fire-and-forget** (it already returns `{success:false}` instead of throwing; log failures, never fail the request over CRM sync). Split the single `name` field on the first space into firstName/lastName.
- **Zero behavior change for unlimitedbroadband** — same utm_source, same env var, same campaign, no ActiveCampaign sync (its config omits the `activeCampaign` block; trivial to add later).
- No new tracking keys needed: quiz answers use the already-whitelisted `quiz_*` prefix.

**Modify `nz-leads/src/lib/activecampaign.ts`:**
- Fix the latent bug: `newContact()` step 2 (line 96 `list: LIST_ID`) and step 3 (line 114 `tag: TAG_ID`) must use the effective `listId`/`tagId` parameters — otherwise the dedicated term-deposit list/tag would silently never be applied. No other changes (the hardcoded API key is pre-existing; flag to Denis but out of scope).

### Ops (Denis / together)

1. **Payload admin** (`https://www.broadband.co.nz/admin` → Leads Campaigns → create):
   - Name `TermDepositRates.co.nz`, slug `termdepositrates`, **Leads reporting: Disabled**.
   - No metas required (distribution metas like `lastAssignedAgent` only matter for reporting campaigns; add later if routing is ever enabled).
2. **ActiveCampaign admin** (`wisecontent1.activehosted.com`, Denis): create a dedicated list (e.g. "Term Deposit Leads") and tag (e.g. "termdepositrates") → note their numeric IDs.
3. **Vercel env (nz-leads project)** — then **redeploy** (env changes only apply on a new build):
   - `LEAD_INTAKE_ALLOWED_ORIGINS` — append `https://www.termdepositrates.co.nz,https://termdepositrates.co.nz` (both hosts — the www omission silently 403'd leads last time).
   - `TERMDEPOSIT_CAMPAIGN_ID=<id from the new campaign's admin URL>`.
   - `TERMDEPOSIT_AC_LIST_ID` + `TERMDEPOSIT_AC_TAG_ID` from step 2.

### Verify

- `pnpm lint` + `pnpm build` green.
- Local dev server: preflight from each allowed origin echoes ACAO; disallowed/missing Origin → 403; honeypot → fake `200 {id:null}`, nothing stored; POST with `02091992…` phone (Veriphone bypass) + `site: 'termdepositrates'` → visitor stored with `utm_source: termdepositrates.co.nz`, `leads_campaign_id` = new campaign, `quiz_*` tracking kept. Regression: unlimitedbroadband-origin POST still stamps its own utm_source/campaign and triggers no ActiveCampaign call. Delete test visitors.
- ActiveCampaign leg: with the AC env vars set locally, one test lead → contact appears in the dedicated AC list with the tag (proves the listId/tagId bug fix); delete the test contact. With AC env vars unset → lead still stores, sync skipped with a log line.
- Deploy: commit → `master` → fast-forward `prod` (~6 min to live). Production smoke test with curl `-H "Origin: https://www.termdepositrates.co.nz"`: OPTIONS → 204 + ACAO echoed (proves env reached the build); honeypot POST → 200 stored-nothing.

---

## Phase 2 — Astro: the `/best-rate-finder` quiz page

### New files

**`src/pages/best-rate-finder.astro`** — follows the canonical page shape (`src/pages/short-term-deposit-rates.astro` as template): frontmatter builds SEO + data, single `<Layout>` wrapper, trailing-slash canonical `${ROOT_URL}/best-rate-finder/`.
- JSON-LD: `webApplicationSchema` from `src/lib/schema.ts` (same as the calculator page) + breadcrumbs.
- Build-time data blob for the reward step: `<script type="application/json" id="quiz-rates-data" is:inline set:html={...}>` containing, per term bucket, the top rates (bank, term label, rate, min deposit) computed with the existing latest-rates readers in `src/lib/rates.ts` (`rate_type='regular'`). Same handoff pattern as `term-deposit-calculator.astro:52`.
- Markup: `[data-quiz]` root, progress bar ("Step N of 5"), 5 step panels:
  1. **Deposit amount** — Under $10k / $10k–$50k / $50k–$100k / $100k+ → `quiz_deposit_amount`
  2. **Term length** — Under 6 months / 6–12 months / 1–2 years / 2+ years → `quiz_term_length`
  3. **Current bank** — logo grid of the major banks (reuse `BankLogo.astro` / `src/lib/logos.ts`) + "Other" + "None" → `quiz_current_bank`
  4. **Timing** — Ready to invest now / Within a month / 1–3 months / Just researching → `quiz_goal_timing`
  5. **Contact** — name, email, phone (all required), consent line, hidden `bot-field` honeypot, inline `#quiz-error` element, submit button "Show My Best Rates".
- Hidden results section: revealed after successful submit — top 3 rates matched to the visitor's term answer (and min-deposit vs their amount bucket), plus a link to the full rates matrix.
- Styling: existing conventions only — card `bg-white rounded-lg shadow-lg p-6`, inputs `block w-full py-3 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500`, blue-600 primary / green-600 for best rates. **Literal Tailwind classes only** (no string-composed class names — the safelist doesn't cover new ones).

**`src/scripts/quiz.ts`** — vanilla-TS island, exact `calculator.ts` conventions: `[data-quiz]` root lookup + `_quizInit` idempotency guard, `root.querySelector` scoping, `initQuiz()` + `document.addEventListener('astro:page-load', initQuiz)`.
- Option-click → store answer in a hidden input, auto-advance, update progress bar; back links.
- Submit: preventDefault → validate with `leadValidation.ts` → disable button → `fetch(import.meta.env.PUBLIC_LEAD_INTAKE_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body })` with:
  ```jsonc
  { "name", "email", "phone", "source": "quiz", "hp": botField,
    "site": "termdepositrates",   // only used by localhost dev; origin governs in prod
    "tracking": [ quiz_deposit_amount, quiz_term_length, quiz_current_bank, quiz_goal_timing,
                  gclid/msclkid/utm_source from location.search, referer from document.referrer ] }
  ```
  (empty values filtered; `utm_medium`/`utm_campaign` are NOT accepted by the endpoint — don't send).
- On 2xx: hide form, render personalized results from the `#quiz-rates-data` blob. On 4xx/network: inline error, re-enable button, no reveal.
- GTM: `window.dataLayer.push` for `quiz_step_view` (each step) and `quiz_lead_submitted` — dataLayer is global via the existing GTM snippet.

**`src/lib/leadValidation.ts`** — `isValidEmail` / `normalizePhone` / `isValidPhone` copied **verbatim** from `nz-leads/src/lib/leadValidation.ts` (comment: keep in sync), same as the unlimitedbroadband copy.

### Modified files

- `src/components/Nav.astro` — add `<a href="/best-rate-finder">Rate Finder</a>` next to the Calculator link.
- `src/components/RelatedLinks.astro` — add a `DEFAULTS` entry; use `<RelatedLinks exclude="/best-rate-finder" />` on the page.
- `.env` (new, gitignored) — `PUBLIC_LEAD_INTAKE_URL=https://www.broadband.co.nz/api/leads/intake` for local dev; same var set in the **Cloudflare build config** (Workers Builds env vars — `PUBLIC_` vars are inlined at build time). If an `src/env.d.ts` exists, declare it there.

### Non-changes (deliberate)

- No `astro.config.mjs` change: new route gets sitemap priority 0.8 (default `else` branch) and the `trailingSlashRedirects()` hook emits its 301 automatically. No wrangler/adapter changes — page is pure static + one island.
- No content-collection entry needed.

---

## Phase 3 — End-to-end verification & deploy

1. `npm run build` — all pages incl. `dist/best-rate-finder/index.html` (page count goes 20 → 21; note CLAUDE.md's "20 pages" is now stale). Built HTML has 5 steps, rates JSON blob, no hardcoded endpoint (URL inlined from env).
2. `npm run preview` walk-through: step navigation, progress bar, back buttons, invalid phone → inline error + no request.
3. **Live round trip without storing a lead** (the proven technique): from `http://localhost:4321` (in the allowlist), submit with the honeypot filled → preflight + POST to production intake → 200 fake-accept, results view renders. Direct bad-email POST → 400 → inline error path.
4. Deploy: push `main` → Cloudflare auto-builds. Confirm `PUBLIC_LEAD_INTAKE_URL` reached the build (deployed JS contains the URL). Honeypot-filled submit from the live `https://www.termdepositrates.co.nz` origin → 200, no CORS errors.
5. **One real test lead** with an `02091992…` phone → appears in Payload admin with `utm_source: termdepositrates.co.nz`, new `leads_campaign_id`, all four `quiz_*` keys, **no** `routed_to` (reporting disabled), and the contact shows up in the ActiveCampaign list with the tag. Delete the visitor and AC contact after.
6. PostHog: server-side `lead_submitted` now fires with the new `campaign_id` — optionally clone the existing volume/phone-validity insight for this campaign.

## Per CLAUDE.md

After approval, copy this plan to `.claude/tasks/best-rate-finder-lead-capture.md` and keep it updated with progress, file paths + line numbers, and deviations.

---

## Progress

- [x] **Phase 1 — nz-leads multi-tenant intake + ActiveCampaign sync** (code complete, verified locally 2026-07-25, committed `9f0facf` on `master` — PUSH PENDING, blocked by permission gate)

  Files (nz-leads repo):
  - `src/app/api/leads/intake/route.ts` — header comment + env docs rewritten; `DEFAULT_UTM_SOURCE` const replaced by `SITE_CONFIGS`/`HOST_TO_SITE`/`resolveSiteConfig()` (origin hostname www-stripped → site; localhost resolves via optional `site` body field, default unlimitedbroadband); campaign env read via `siteConfig.campaignIdEnv`; new `syncToActiveCampaign()` called after `newLead()` succeeds — awaited (serverless would drop a dangling promise), never fails the request, logs skip/failure.
  - `src/lib/activecampaign.ts:96,114` — `newContact()` now uses its `listId`/`tagId` params (was hardcoded `LIST_ID`/`TAG_ID` — latent bug).

  Verified against local dev server (localhost:3000, local mongo `broadband-co-nz`, two throwaway `disabled` campaigns, all test data deleted after):
  - `pnpm lint` clean (2 pre-existing warnings only); `pnpm build` green, `ƒ /api/leads/intake` registered.
  - OPTIONS www + bare termdepositrates origins → 204 + ACAO echoed; evil origin → no ACAO; POST without Origin → 403; honeypot → 200 `{id:null}` + nothing stored; bad email → 400.
  - TD-origin lead → `utm_source: termdepositrates.co.nz`, TD `leads_campaign_id`, all `quiz_*` keys kept, `evil_key` dropped, phone normalized `02091992001`, `flag: valid_phone` (Veriphone bypass).
  - UBB-origin regression → own utm_source/campaign, NO ActiveCampaign log.
  - localhost origin + `site: termdepositrates` → TD config applied.
  - AC skip-log fired exactly for the 2 TD leads (`TERMDEPOSIT_AC_LIST_ID/TERMDEPOSIT_AC_TAG_ID not set`).

  Deviations: (1) live ActiveCampaign call NOT tested — needs Denis's dedicated list/tag IDs; deferred to Phase 3 step 5. (2) AC sync awaited, not fire-and-forget — Vercel can freeze the instance after the response, dropping dangling promises.

  **Denis's ops before TD leads flow:** Payload campaign doc (reporting: Disabled) → `TERMDEPOSIT_CAMPAIGN_ID`; AC list+tag → `TERMDEPOSIT_AC_LIST_ID`/`TERMDEPOSIT_AC_TAG_ID`; append both TD origins + keep `http://localhost:4321` in `LEAD_INTAKE_ALLOWED_ORIGINS` (Vercel) → redeploy; push `master` → `prod`.

- [x] **Phase 2 — Astro `/best-rate-finder` quiz page** (code complete, verified 2026-07-25)

  Files (this repo):
  - `src/lib/rates.ts` — added `FinderRate`/`FinderBucket`/`RateFinderData` types, `finderBucket()`, `rateFinderData()` (latest regular rates → 4 term buckets, best rate per bank per bucket, sorted desc; minDeposit in dollars) just above the calculator-data section.
  - `src/lib/leadValidation.ts` (new) — verbatim typed copy of nz-leads validators.
  - `src/env.d.ts` (new) — declares `PUBLIC_LEAD_INTAKE_URL`.
  - `.env` (new, gitignored) — local `PUBLIC_LEAD_INTAKE_URL=https://www.broadband.co.nz/api/leads/intake`.
  - `src/pages/best-rate-finder.astro` (new) — canonical page shape, `webApplicationSchema` JSON-LD, breadcrumbs, `#quiz-rates-data` build-time blob (`{updatedLabel, buckets}`), 5-step form ([data-quiz-step] fieldsets: amount w/ data-bound, term w/ data-bucket, bank logo grid (ANZ/ASB/BNZ/Westpac/Kiwibank/TSB + Other + No bank yet), timing, contact w/ `bot-field` honeypot + consent line), hidden results section.
  - `src/scripts/quiz.ts` (new) — calculator.ts conventions (`[data-quiz]` root, `_quizInit` guard, `astro:page-load` re-init); option click → hidden input + auto-advance; back button; client validation via leadValidation; POST `{name,email,phone,source:'quiz',hp,site:'termdepositrates',tracking:[quiz_*×4, gclid/msclkid/utm_source, referer]}` to `PUBLIC_LEAD_INTAKE_URL`; button disabled in flight; on 2xx renders top-3 matched rates (bucket filtered by minDeposit ≤ amount-bucket lower bound, fallback unfiltered); GTM `quiz_step_view`/`quiz_lead_submitted` dataLayer pushes.
  - `src/components/Nav.astro` — "Rate Finder" link after Calculator.
  - `src/components/RelatedLinks.astro` — DEFAULTS entry for /best-rate-finder.

- [x] **Phase 3 — verification** (2026-07-25)
  - `npm run build` green — **24 pages** (CLAUDE.md's "20 pages" figure is stale; not edited). `dist/best-rate-finder/index.html` has all 5 steps + rates blob; intake URL inlined into the island chunk; `_redirects` 301 and sitemap entry emitted automatically; nav/RelatedLinks links present site-wide.
  - Browser walk-through on `npm run preview` (localhost:4321): steps advance with progress bar + back button; all 6 bank logos render (initial blank tiles were lazy-load timing only); invalid phone → inline error, NO network request; **honeypot-filled submit against PRODUCTION intake → 200 fake-accept from origin http://localhost:4321 (already allowlisted from the UBB integration), results view rendered top-3 6–12-month rates correctly min-deposit-filtered for the $10k–$50k bucket (Rabobank 3.95% best match, ASB/BNZ 3.90%)**; dataLayer got quiz_step_view 1–5 + quiz_lead_submitted; zero console errors.
  - NOT yet proven (needs Denis's ops + deploys): TD origins in prod allowlist, campaign attribution in prod, ActiveCampaign live sync, live-origin smoke test. See ops checklist in Phase 1 entry.

  **Deviation (Denis, 2026-07-25):** the intake URL is committed as a default constant in `src/scripts/quiz.ts` (`INTAKE_URL`) instead of relying on a Cloudflare build-time env var, which gets reset between builds on this setup. `PUBLIC_LEAD_INTAKE_URL` remains as an optional dev override only (`src/env.d.ts` updated, local `.env` removed). Verified: build with no env vars still inlines the production URL into the island chunk. Cloudflare needs NO env config for this feature.

  **Correction (Denis, 2026-07-25):** replaced the hardcoded-constant approach with Astro's `astro:env` schema — `PUBLIC_LEAD_INTAKE_URL` is declared in `astro.config.mjs` (`envField.string({ context: 'client', access: 'public', default: <production URL> })`) and imported from `astro:env/client` in `src/scripts/quiz.ts`. The committed default survives Cloudflare builds (their build-time env vars reset); a real env var still overrides for dev. `src/env.d.ts` deleted (astro:env generates its own types). Verified: build with no env inlines the production URL; build with the var set inlines the override.
