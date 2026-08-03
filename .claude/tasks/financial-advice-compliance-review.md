# Financial-advice & claims compliance pass (NZ)

**Date:** 2026-08-03
**Trigger:** Review `/best-rate-finder/` quiz + its banners for financial-advice exposure under NZ
law; extended to a full-site claims review at the user's request.

> **Not legal advice.** This is an engineering pass based on primary sources (FMCA 2013, IRD, RBNZ)
> and FMA published guidance. A NZ financial services lawyer should sign off before relying on it.

---

## 1. The legal frame this work is built on

**FMCA s 431C(1)(a)** — you give financial advice if you "make a recommendation or give an opinion
about acquiring or disposing of ... a financial advice product."

A term deposit **is in scope**: s 8(1)(a) "a right to be repaid money or paid interest on money that
is ... deposited with ... any person" → debt security → financial product (s 7(1)(a)) → financial
advice product (s 6). It is regulated advice if given in the ordinary course of a business
(s 431C(3)(a)) — which this is.

**The safe harbour is Schedule 5 cl 7(a)**: not financial advice merely by "providing factual
information (for example, information about the cost or terms and conditions of a financial advice
product)". Clause 7(c) additionally protects opinions about a *kind* of product generally rather
than a particular one.

**Governing distinction for every copy change below:**
> "Best rates" describing **a number** (the highest published rate) is factual.
> "Best for you" describing **a person** is an opinion about a particular product.

Also engaged: FMCA ss 19–23 (fair dealing: misleading conduct, false representations,
unsubstantiated representations), Fair Trading Act 1986 ss 9/12A/13, Privacy Act 2020 (IPP 1, 3, 11),
Unsolicited Electronic Messages Act 2007.

**Key structural finding:** `rateFinderData()` (`src/lib/rates.ts:591-617`) ranks purely by
`interest_rate` descending, one row per bank per term bucket, filtered by minimum deposit. There is
no suitability scoring anywhere in the codebase. So this is a **copywriting problem, not an
architecture problem** — the tool already does something defensible under cl 7(a), it just described
itself as a recommendation engine.

---

## 2. Decisions taken (user-directed, 2026-08-03)

| Question | Decision |
|---|---|
| Phone field | Keep required. Consent copy states generically that they may be contacted **by email or phone about rates or other products**. |
| "We never share your details with third parties" | **Remove.** Replace with explicit partner-sharing disclosure modelled on the broadband site's wording, tailored to financial services. This is the honest option and makes Privacy Act IPP 3/11 disclosure sound. |
| Dead footer legal links | Write **both** `/privacy-policy` and `/disclaimer` as substantive drafts, marked for legal review. Page count 24 → 26. |

---

## 3. Work plan

### Phase 1 — Factual corrections (highest priority; not advice-related)

**1.1 Depositor Compensation Scheme is live and the site denies it exists.**
The DCS took effect **1 July 2025** under the Deposit Takers Act 2023 — **$100,000 per depositor per
licensed deposit taker**, administered by RBNZ. FMCA s 22(h) was amended on 1 July 2025 specifically
to capture false representations about Part 6 Deposit Takers Act guarantees.

- `src/lib/schema.ts:213-216` — homepage FAQ JSON-LD answer.
- `src/pages/index.astro:268-269` — the visible copy. **Note:** this text is duplicated, not shared;
  both must change identically or the FAQ rich result breaks Google's "JSON-LD must match visible
  text" rule.
- Provider pages that say deposit protection "continues to evolve" / "check current arrangements"
  are now stale rather than wrong — leave, but they benefit from the DCS being stated once centrally.

**1.2 RWT tables are wrong on two counts.**
Site lists the **pre-31-July-2024** brackets *and* drops the 39% bracket entirely. A >$180k earner
following this page under-deducts and gets an end-of-year tax bill.

Correct (IRD, from 31 July 2024): 10.5% ≤ $15,600 · 17.5% $15,601–$53,500 · 30% $53,501–$78,100 ·
33% $78,101–$180,000 · 39% $180,001+. Default 33% if no rate nominated; 45% with no IRD number.

- `src/content/pages/short-term-deposit-rates.md:41-44`
- `src/content/pages/long-term-deposit-rates.md:44-47`

**1.3 Unqualified capital-guarantee claims.** Above the DCS cap a depositor is an unsecured creditor
and can be hair-cut under RBNZ's Open Bank Resolution policy. "Principal guaranteed" full stop is not
accurate.

- `src/pages/index.astro:138` "Your principal amount is secure"
- `src/pages/index.astro:144` "maximise returns without risk"
- `src/pages/index.astro:177` "you won't lose your principal"
- `src/pages/pie-term-deposit-rates.astro:150-151` table row "Principal guaranteed" ×2
- `src/content/pages/short-term-deposit-rates.md:12` "Capital protection: Your principal is secure"
- `src/content/pages/long-term-deposit-rates.md:110` "Principal Protection"

**1.4 PIE overstatements.**
- `src/pages/pie-term-deposit-rates.astro:114` "No Additional Tax ... don't create additional tax
  obligations" — false if the PIR used is too low; IRD squares it up. Qualify.
- `:186-191` worked example maths is correct ($2,250 gross; $1,507.50 @33%; $1,620.00 @28%; $112.50
  saving) but assumes an **identical headline rate** for both products, which the same page
  contradicts at `:165`. Add that caveat.

### Phase 2 — Quiz + banner advice framing

**2.1 `src/components/RateFinderCta.astro`** (renders on all 8 rate pages)
- `:16` "Not sure which term deposit is right for you?" → suitability question, remove.
- `:18` "we'll match you with today's best rates for your deposit amount and term" → "match you" +
  "for your" is recommendation language.
- `:27` "Find My Best Rate →" → possessive framing.

**2.2 `src/pages/best-rate-finder.astro`**
- `:12` title, `:14` description, `:19` JSON-LD description — all carry "best ... for your".
- `:60` h1 "Find Your Best Term Deposit Rate" → "highest" is measurable, "your best" is an opinion.
- `:62-63` subheading.
- `:112` "How long do you want to invest for?" / `:149` "When are you looking to invest?" —
  investment-decision framing compounds the above.
- `:43-44` "Lock in a solid rate" / "Maximum certainty" — opinions about product kinds.
- `:196` "your personalised rate summary" — literally self-describes as personalised.
- `:197` + `:218` — sharing claims, see Phase 4.
- `:205` results heading "Your best rates".

**2.3 `src/scripts/quiz.ts`**
- `:118` `"Best match"` badge on a **named bank's product** — highest-risk single string on the site.
  → `"Highest rate"`.
- `:103-104` results subheading "Today's top {term} rates for your deposit".

**2.4 No disclaimer on the quiz page at all** — every provider page has one; the highest-risk page
does not. Note a disclaimer does **not** cure conduct that is actually regulated advice (you cannot
disclaim out of s 431C) but it materially supports the cl 7(a) factual-information framing.

### Phase 3 — Disclaimer coverage

New reusable `src/components/Disclaimer.astro`. Six pages currently have **no disclaimer of any
kind**: short-term, long-term, 6-month, 12-month, calculator, best-rate-finder. (index, PIE and
seniors already have good ones — reuse their wording as the model.)

Also `src/content/providers/tsb-bank.md` and `rabobank.md` lack the not-advice sentence the other 13
providers carry.

### Phase 4 — Privacy, consent, legal pages

- New `src/pages/privacy-policy.astro` — IPP 3 collection notice: what's collected (name, email,
  phone, gclid/msclkid/utm_source/referrer), why, that it goes to ActiveCampaign and trusted
  financial-services partners, GTM/analytics cookies, access & correction rights, contact point.
- New `src/pages/disclaimer.astro` — not-financial-advice statement, rate sourcing and lag, DCS
  position, no-warranty on third-party data.
- `src/components/Footer.astro:50-51` — replace `href="#"` on both links.
- Quiz consent block — replace the "never share" promise with explicit partner-sharing disclosure
  covering email **and** phone contact.

### Phase 5 — Substantiation tightening

- "every major New Zealand bank" appears on index/PIE/short/long/seniors/6mo/12mo/[slug]/calculator.
  On the **PIE page** this is the weakest — far fewer banks offer PIE. Drive from the actual bank
  count where a count is already in scope.
- Name **interest.co.nz** as the rate source rather than "public bank data".
- `src/scripts/quiz.ts:75,92` — `amountBound` is the **lower** bound of the selected band, so someone
  with $40k who picks "$10k–$50k" is filtered against $10,000 and a bank with a $25k minimum is
  wrongly excluded. `:93` also silently shows **unaffordable** options when nothing matches. Either
  fix or state the assumption; the claim "best rates for your deposit amount" is otherwise not
  substantiated.
- `:93` `slice(0, 3)` — copy promises "every major NZ bank", UI shows three.
- `src/pages/term-deposit-rates-for-seniors.astro:74` "suitable for retirees and seniors" — a
  suitability claim on the page aimed at the most vulnerable audience. FMA guidance explicitly calls
  out considering vulnerable audiences.

---

## 4. Verification

- `npm run build` — must pass with **26** pages (24 + privacy-policy + disclaimer).
- `npm run preview` — check quiz flow end to end, banner on a rate page, both new legal pages.
- Confirm homepage FAQ JSON-LD still matches the visible DCS answer verbatim.
- No `npx wrangler deploy --dry-run` needed unless deploy config is touched (it isn't).

---

## 5. Progress log

**Implemented 2026-08-03. Build: 26 pages, clean. Verified in preview.**

Late user direction: **do not name interest.co.nz as the rate source** — where the rates come from
is not something to publish. All source attribution removed sitewide; the honest part of the
disclosure (collected once a day, may not match a bank's current offer, verify with the bank) is
kept. `dist/` verified free of the string.

### Phase 1 — factual corrections
- `src/lib/schema.ts:213-216` + `src/pages/index.astro:269` — DCS answer rewritten in both places.
  Verified in `dist/index.html` that the visible `<p>` and the FAQPage JSON-LD `acceptedAnswer` are
  byte-identical, preserving the rich result.
- `src/content/pages/short-term-deposit-rates.md:41-49` and
  `src/content/pages/long-term-deposit-rates.md:44-50` — RWT tables corrected to the from-31-July-2024
  brackets, 39% tier added, default 33% / no-IRD-number 45% noted, IRD link added.
- Capital-guarantee claims qualified: `index.astro:138,144,177`,
  `pie-term-deposit-rates.astro:150-151`, `short-term…md:12`, `long-term…md:113`.
- `pie-term-deposit-rates.astro:114` PIR square-up qualified; `:186-192` worked example given a
  same-headline-rate caveat (the arithmetic itself was checked and is correct).
- `faq.ts:185` PIE security answer rewritten around DCS structure dependence.

### Phase 2 — quiz + banner
- `RateFinderCta.astro:16,18,27` — suitability question and "match you / my best rate" removed.
- `best-rate-finder.astro` — title, meta description, JSON-LD description, h1, subheading, step 2 and
  step 4 legends, term-option hints, results heading, footer line.
- `quiz.ts:118` — `"Best match"` → `"Highest rate"`.
- `quiz.ts` `matchedRates()` refactored to return `{rates, affordableOnly}`; results subheading now
  states the actual minimum-deposit bound used, and says so explicitly when it fell back to the
  unfiltered list instead of silently showing deposits the visitor may not qualify for.

### Phase 3 — disclaimer coverage
- New `src/components/Disclaimer.astro`, added to best-rate-finder, short-term, long-term, 6-month,
  12-month and calculator (the six pages that had none).
- `providers/tsb-bank.md` and `providers/rabobank.md` — not-advice sentence added.
- Verified all 26 built pages now carry an advice notice.

### Phase 4 — privacy / consent / legal pages
- New `src/pages/privacy-policy.astro` and `src/pages/disclaimer.astro` (**drafts — need legal
  review**; privacy policy has a placeholder contact address to fill in).
- `Footer.astro:50-51` — dead `href="#"` links wired up; footer note now leads with the not-advice line.
- Quiz consent block rewritten to the user's chosen wording: explicit disclosure that details are
  shared with trusted banking and financial services partners who may contact by email, phone or
  text. The "we never share your details with third parties" and "we don't sell your details" claims
  are gone.

### Phase 5 — substantiation
- "every major New Zealand bank" softened across index / short / long / PIE / seniors / 6mo / 12mo.
  PIE now says "the New Zealand banks that offer PIE deposits" rather than implying full coverage.
- `term-deposit-rates-for-seniors.astro:52,74,86-88,105` — "suitable for retirees", "dependable,
  predictable returns", "guaranteed" and the "smartest move / usually beats a loyalty bonus" opinion
  all reworded.
- `faq.ts:133` — "Is a {label} term deposit right for me?" → "What is a {label} term deposit
  typically used for?"
- Remaining "guaranteed returns" / "Perfect for" / "safe haven" / "excellent for" phrasing replaced
  across both long-form markdown pages and index.astro.

### Deliberately NOT done
- **Phone left required** (user decision). Consent copy now discloses phone contact, but a required
  phone number to view otherwise-public rates remains a soft IPP 1 exposure.
- **No live lead submitted during verification** — the quiz POSTs to the production nz-leads intake,
  so the results screen was verified via the built bundle strings rather than an end-to-end submit.
  Worth one manual submit with a real address before/after deploy.
- `index.astro:54` meta description still says "every major NZ bank" — it names ANZ/ASB/BNZ/Westpac/
  Kiwibank immediately after, which substantiates it. Left as-is.

### Follow-ups for the user
1. Have a NZ financial services / privacy lawyer review both new pages before relying on them.
2. Fill in the privacy policy contact address placeholder.
3. Confirm the partner-sharing description matches what actually happens in nz-leads — the copy now
   promises disclosure to partners, so the pipeline and the policy need to agree.
4. Re-check the DCS and RWT figures annually; both are now stated as specific numbers with dates.
