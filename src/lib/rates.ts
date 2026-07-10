/**
 * Data / query layer — TypeScript port of RatesController + ProvidersController.
 *
 * Reads the committed db/rates.db at BUILD TIME via better-sqlite3. All the
 * scoring/matrix/card logic that used to live in the Rails controllers lives
 * here as plain functions:
 *   latestRates, bankList, distinctTerms, sortTerms, termInMonths,
 *   createRatesMatrix, calculateValueScore, calculateBestRates,
 *   generateSummaryCards, provider helpers.
 *
 * Append-history model: every page reads "the latest row per bank/term".
 *
 * Note on rate_type: the Rails home/short/long/calculator/provider queries had
 * no rate_type filter and only avoided mixing in PIE rows because PIE was
 * scraped at a different timestamp. We scrape regular + PIE in one run (one
 * scraped_at), so we filter the bank-facing queries to 'regular' explicitly and
 * the PIE page to 'pie'. This matches intent and avoids PIE rows leaking into
 * the home matrix.
 */

import Database from "better-sqlite3";
import { join } from "node:path";
import { pct, dayMonthYear } from "./format";

// Anchored to the project root (cwd during `astro build` / scrape), not the
// bundled module location — Vite moves this file into dist/.prerender/chunks.
const DB_PATH = join(process.cwd(), "db", "rates.db");

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (!_db) _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return _db;
}

export type RateType = "regular" | "pie";

export interface Rate {
  id: number;
  bank_name: string;
  parent_bank_name: string;
  product_variant: string | null;
  term_length: string;
  interest_rate: number;
  credit_rating: string | null;
  minimum_deposit: number | null;
  credit_code: string | null;
  paid_code: string | null;
  rate_type: RateType;
  scraped_at: string;
}

export interface BankInfo {
  bank_name: string; // display name (parent + variant)
  parent_bank_slug: string;
  credit_rating: string | null;
  minimum_deposit: number | null;
}

// ---------------------------------------------------------------------------
// Small string/util ports
// ---------------------------------------------------------------------------

/** ActiveSupport-style `parameterize`: lowercase, non-alphanumerics → "-". */
export function parameterize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Display name, mirroring Rate#display_name. */
export function displayName(r: Rate): string {
  return r.product_variant ? `${r.parent_bank_name} ${r.product_variant}` : r.parent_bank_name;
}

/** Clean a parent_bank_name for human display (strips the "SBS Bank." dot). */
export function cleanBankName(name: string): string {
  return name.replace(/\.+$/, "");
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Term sorting (ports of sort_terms / term_in_months)
// ---------------------------------------------------------------------------

function termSortKey(term: string): [number, number] {
  const num = parseInt((term.match(/\d+/)?.[0] ?? "0"), 10);
  if (term.includes("month") && !term.includes("mths")) return [1, num];
  if (term.includes("mths")) return [2, num];
  if (term.includes("year")) return [3, num];
  return [4, 0];
}

export function sortTerms(terms: string[]): string[] {
  return [...terms].sort((a, b) => {
    const ka = termSortKey(a);
    const kb = termSortKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1];
  });
}

export function termInMonths(term: string): number {
  const t = term.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+)\s*month/))) return parseInt(m[1], 10);
  if ((m = t.match(/(\d+)\s*mths/))) return parseInt(m[1], 10);
  if ((m = t.match(/(\d+)\s*years?/))) return parseInt(m[1], 10) * 12;
  return 0;
}

export function distinctTerms(rates: Rate[]): string[] {
  return sortTerms([...new Set(rates.map((r) => r.term_length))]);
}

/** Unique parent banks for the logo strip: { slug, name } in alpha order. */
export function logoStripParents(rates: Rate[]): { slug: string; name: string }[] {
  const seen = new Set<string>();
  const out: { slug: string; name: string }[] = [];
  for (const r of rates) {
    const slug = parameterize(r.parent_bank_name);
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push({ slug, name: r.parent_bank_name });
    }
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

export function latestScrapeAt(rateType?: RateType): string | null {
  const row = rateType
    ? (db().prepare("SELECT MAX(scraped_at) AS m FROM rates WHERE rate_type = ?").get(rateType) as { m: string | null })
    : (db().prepare("SELECT MAX(scraped_at) AS m FROM rates").get() as { m: string | null });
  return row?.m ?? null;
}

/**
 * Latest row per (bank_name, term_length) within a rate_type, optionally
 * restricted to a set of term_lengths. Ordered like the Rails controllers:
 * parent_bank_name, product_variant (NULLs first), term_length.
 */
export function latestRates(opts: { rateType: RateType; termLengths?: string[] }): Rate[] {
  const { rateType, termLengths } = opts;
  const termFilter =
    termLengths && termLengths.length
      ? `AND term_length IN (${termLengths.map((_, i) => `@t${i}`).join(",")})`
      : "";
  const outerTermFilter =
    termLengths && termLengths.length
      ? `AND r.term_length IN (${termLengths.map((_, i) => `@t${i}`).join(",")})`
      : "";

  const sql = `
    SELECT r.* FROM rates r
    INNER JOIN (
      SELECT bank_name, term_length, MAX(scraped_at) AS max_scraped_at
      FROM rates
      WHERE rate_type = @rateType ${termFilter}
      GROUP BY bank_name, term_length
    ) latest
      ON r.bank_name = latest.bank_name
      AND r.term_length = latest.term_length
      AND r.scraped_at = latest.max_scraped_at
    WHERE r.rate_type = @rateType ${outerTermFilter}
    ORDER BY r.parent_bank_name ASC, r.product_variant ASC, r.term_length ASC
  `;

  const params: Record<string, unknown> = { rateType };
  termLengths?.forEach((t, i) => (params[`t${i}`] = t));
  return db().prepare(sql).all(params) as Rate[];
}

// ---------------------------------------------------------------------------
// Bank list (port of the @banks builder)
// ---------------------------------------------------------------------------

export function bankList(rates: Rate[]): BankInfo[] {
  const byDisplay = new Map<string, Rate>();
  for (const r of rates) {
    const dn = displayName(r);
    if (!byDisplay.has(dn)) byDisplay.set(dn, r); // keep first (rates are pre-sorted)
  }
  return [...byDisplay.entries()]
    .sort(([, a], [, b]) => {
      const pb = a.parent_bank_name < b.parent_bank_name ? -1 : a.parent_bank_name > b.parent_bank_name ? 1 : 0;
      if (pb) return pb;
      const av = a.product_variant ?? "";
      const bv = b.product_variant ?? "";
      return av < bv ? -1 : av > bv ? 1 : 0;
    })
    .map(([dn, info]) => ({
      bank_name: dn,
      parent_bank_slug: parameterize(info.parent_bank_name),
      credit_rating: info.credit_rating,
      minimum_deposit: info.minimum_deposit,
    }));
}

// ---------------------------------------------------------------------------
// Matrix (port of create_rates_matrix)
// ---------------------------------------------------------------------------

export type RatesMatrix = Record<string, Record<string, Rate | null>>;

export function createRatesMatrix(rates: Rate[], terms: string[], bankNames: string[]): RatesMatrix {
  const matrix: RatesMatrix = {};
  for (const term of terms) {
    matrix[term] = {};
    for (const bank of bankNames) matrix[term][bank] = null;
  }
  for (const rate of rates) {
    const term = rate.term_length;
    const dn = displayName(rate);
    if (matrix[term] && dn in matrix[term]) matrix[term][dn] = rate;
  }
  return matrix;
}

// ---------------------------------------------------------------------------
// Value scoring + best rates (ports)
// ---------------------------------------------------------------------------

export function calculateValueScore(rate: Rate, comparison: Rate[]): number {
  const interestRates = comparison.map((r) => r.interest_rate);
  const minRate = Math.min(...interestRates);
  const maxRate = Math.max(...interestRates);
  const rateRange = maxRate - minRate;
  const rateScore = rateRange === 0 ? 1.0 : (rate.interest_rate - minRate) / rateRange;

  const deposits = comparison.map((r) => r.minimum_deposit).filter((d): d is number => d != null);
  let depositScore: number;
  if (deposits.length) {
    const minDep = Math.min(...deposits);
    const maxDep = Math.max(...deposits);
    const depRange = maxDep - minDep;
    if (depRange === 0 || rate.minimum_deposit == null) depositScore = 1.0;
    else depositScore = 1.0 - (rate.minimum_deposit - minDep) / depRange;
  } else {
    depositScore = 1.0;
  }

  return rateScore * 0.7 + depositScore * 0.3;
}

export interface BestRates {
  overall: { first: Rate; top_3: number[]; top_10_percent: number[] };
  per_term: Record<string, number>;
  rate_ids: {
    best_overall: number | undefined;
    top_3: number[];
    top_10_percent: number[];
    term_winners: number[];
  };
}

export function calculateBestRates(rates: Rate[]): BestRates | null {
  if (!rates.length) return null;

  const scored = rates.map((r) => ({ rate: r, score: calculateValueScore(r, rates) }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  const overall = {
    first: sorted[0].rate,
    top_3: sorted.slice(0, 3).map((s) => s.rate.id),
    top_10_percent: sorted.slice(0, Math.ceil(sorted.length * 0.1)).map((s) => s.rate.id),
  };

  const per_term: Record<string, number> = {};
  for (const [term, termRates] of groupBy(rates, (r) => r.term_length)) {
    const best = termRates
      .map((r) => ({ rate: r, score: calculateValueScore(r, termRates) }))
      .reduce((m, c) => (c.score > m.score ? c : m));
    per_term[term] = best.rate.id;
  }

  return {
    overall,
    per_term,
    rate_ids: {
      best_overall: overall.first?.id,
      top_3: overall.top_3,
      top_10_percent: overall.top_10_percent,
      term_winners: Object.values(per_term),
    },
  };
}

// ---------------------------------------------------------------------------
// Summary cards (port of generate_summary_cards)
// ---------------------------------------------------------------------------

export interface SummaryCard {
  title: string;
  subtitle: string;
  rate: number;
  bank: string;
  term: string;
  icon: string;
  highlight: "gold" | "blue" | "green" | "purple";
  description: string;
}

function maxBy<T>(items: T[], by: (t: T) => number): T {
  return items.reduce((m, c) => (by(c) > by(m) ? c : m));
}

export function generateSummaryCards(rates: Rate[], bestRates: BestRates | null): SummaryCard[] {
  if (!rates.length || !bestRates) return [];
  const cards: SummaryCard[] = [];

  // Card 1: Overall best (by value score)
  const best = bestRates.overall.first;
  if (best) {
    cards.push({
      title: "Highest Rate",
      subtitle: "Best overall return",
      rate: best.interest_rate,
      bank: displayName(best),
      term: best.term_length,
      icon: "🏆",
      highlight: "gold",
      description: "Top rate across all terms",
    });
  }

  // Card 2: Best short-term (≤12 months, by interest_rate)
  const shortTerm = rates.filter((r) => termInMonths(r.term_length) <= 12);
  if (shortTerm.length) {
    const bestShort = maxBy(shortTerm, (r) => r.interest_rate);
    cards.push({
      title: "Best Short-Term",
      subtitle: "≤12 months",
      rate: bestShort.interest_rate,
      bank: displayName(bestShort),
      term: bestShort.term_length,
      icon: "⚡",
      highlight: "blue",
      description: "Quick access to funds",
    });
  }

  // Card 3: Best long-term (≥24 months)
  const longTerm = rates.filter((r) => termInMonths(r.term_length) >= 24);
  if (longTerm.length) {
    const bestLong = maxBy(longTerm, (r) => r.interest_rate);
    cards.push({
      title: "Best Long-Term",
      subtitle: "2+ years",
      rate: bestLong.interest_rate,
      bank: displayName(bestLong),
      term: bestLong.term_length,
      icon: "📈",
      highlight: "green",
      description: "Maximum growth potential",
    });
  }

  // Card 4: Best medium-term (term contains "12")
  const mediumTerm = rates.filter((r) => r.term_length.includes("12"));
  if (mediumTerm.length) {
    const bestMedium = maxBy(mediumTerm, (r) => r.interest_rate);
    cards.push({
      title: "Best Medium-Term",
      subtitle: "12 month term",
      rate: bestMedium.interest_rate,
      bank: displayName(bestMedium),
      term: bestMedium.term_length,
      icon: "⭐",
      highlight: "purple",
      description: "Balanced term length",
    });
  }

  return cards.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Aggregate stats used by the inline page content
// ---------------------------------------------------------------------------

export interface RateStats {
  minRate: number;
  maxRate: number;
  avgMinDeposit: number | null; // dollars
  minMinDeposit: number | null; // dollars
  maxMinDeposit: number | null; // dollars
  bankCount: number;
  termCount: number;
}

export function rateStats(rates: Rate[], banks: BankInfo[], terms: string[]): RateStats {
  const interest = rates.map((r) => r.interest_rate);
  const deposits = rates.map((r) => r.minimum_deposit).filter((d): d is number => d != null);
  const avgCents = deposits.length ? deposits.reduce((a, b) => a + b, 0) / deposits.length : null;
  return {
    minRate: interest.length ? Math.min(...interest) : 0,
    maxRate: interest.length ? Math.max(...interest) : 0,
    avgMinDeposit: avgCents != null ? Math.trunc(avgCents / 100) : null,
    minMinDeposit: deposits.length ? Math.trunc(Math.min(...deposits) / 100) : null,
    maxMinDeposit: deposits.length ? Math.trunc(Math.max(...deposits) / 100) : null,
    bankCount: banks.length,
    termCount: terms.length,
  };
}

// ---------------------------------------------------------------------------
// Term leaders — standalone "citable" sentences for AI answer engines.
//
// AI systems extract single self-contained sentences that pair a specific
// claim + a date + a named entity; they don't parse rate tables well. These
// helpers turn the live data into plain-text sentences rendered as real HTML
// (see RateSummary.astro), e.g.:
//   "As of 23 June 2026, the highest 12-month term deposit rate in NZ is
//    4.50%, offered by SBS Bank."
// ---------------------------------------------------------------------------

/** Human term label from a DB term string: "12 mths" → "12-month", "2 years" → "2-year". */
export function termLabel(term: string): string {
  const months = termInMonths(term);
  if (months === 0) return term;
  return months < 24 ? `${months}-month` : `${months / 12}-year`;
}

/** Join cleaned bank names into a natural-language list, collapsing long ties. */
function joinBanks(names: string[]): string {
  const n = names.length;
  if (n === 0) return "";
  if (n === 1) return names[0];
  if (n === 2) return `${names[0]} and ${names[1]}`;
  if (n === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  const others = n - 3;
  return `${names[0]}, ${names[1]}, ${names[2]} and ${others} other bank${others === 1 ? "" : "s"}`;
}

export interface TermLeader {
  term: string; // raw DB term_length, e.g. "12 mths"
  termLabel: string; // human, e.g. "12-month"
  rate: number; // highest interest_rate for this term
  banks: string[]; // cleaned display names of the leader(s) (ties)
  sentence: string; // full standalone citable sentence
}

/**
 * The market-leading rate per term, as standalone sentences. Terms are returned
 * in sortTerms() order. `banks` holds every leader when rates tie.
 */
export function termLeaders(rates: Rate[], asOfIso: string | null): TermLeader[] {
  const asOf = asOfIso ? dayMonthYear(asOfIso) : "today";
  const byTerm = groupBy(rates, (r) => r.term_length);
  const leaders: TermLeader[] = [];
  for (const term of sortTerms([...byTerm.keys()])) {
    const termRates = byTerm.get(term)!;
    const maxRate = Math.max(...termRates.map((r) => r.interest_rate));
    // Dedupe leader display names (variants of one bank can repeat).
    const banks = [
      ...new Set(termRates.filter((r) => r.interest_rate === maxRate).map((r) => cleanBankName(displayName(r)))),
    ].sort();
    const label = termLabel(term);
    leaders.push({
      term,
      termLabel: label,
      rate: maxRate,
      banks,
      sentence: `As of ${asOf}, the highest ${label} term deposit rate in NZ is ${pct(maxRate)}, offered by ${joinBanks(banks)}.`,
    });
  }
  return leaders;
}

export interface BankLeaderSummary {
  headline: string; // "As of <date>, <Bank>'s highest term deposit rate is X% for a Y-month term."
  nationalLeads: string[]; // sentences for terms where this bank leads NZ
}

/**
 * Bank-specific citable sentences for a provider page. `allRates` is that bank's
 * latest rows; `marketLeaders` is termLeaders() over the whole regular market so
 * we can flag where the bank holds the national lead.
 */
export function bankLeaderSummary(
  bankName: string,
  allRates: Rate[],
  marketLeaders: TermLeader[],
  asOfIso: string | null
): BankLeaderSummary | null {
  if (!allRates.length) return null;
  const asOf = asOfIso ? dayMonthYear(asOfIso) : "today";
  const best = maxBy(allRates, (r) => r.interest_rate);
  const headline = `As of ${asOf}, ${bankName}'s highest term deposit rate is ${pct(best.interest_rate)} for a ${termLabel(best.term_length)} term.`;

  // This bank's own best rate per term, so we can flag national leads by value
  // (robust against parent/variant display-name differences).
  const bankMaxByTerm = new Map<string, number>();
  for (const r of allRates) {
    const cur = bankMaxByTerm.get(r.term_length);
    if (cur == null || r.interest_rate > cur) bankMaxByTerm.set(r.term_length, r.interest_rate);
  }
  const nationalLeads: string[] = [];
  for (const leader of marketLeaders) {
    if (leader.rate > 0 && bankMaxByTerm.get(leader.term) === leader.rate) {
      nationalLeads.push(
        `${bankName} currently offers New Zealand's highest ${leader.termLabel} term deposit rate at ${pct(leader.rate)}.`
      );
    }
  }
  return { headline, nationalLeads };
}

// ---------------------------------------------------------------------------
// Page data builders
// ---------------------------------------------------------------------------

export interface MatrixPageData {
  latestScrapeAt: string | null;
  rates: Rate[];
  banks: BankInfo[];
  terms: string[];
  matrix: RatesMatrix;
  bestRates: BestRates | null;
  summaryCards: SummaryCard[];
  stats: RateStats;
}

/** Home / short / long / pie pages. */
export function matrixPageData(opts: { rateType: RateType; termLengths?: string[] }): MatrixPageData {
  const rates = latestRates(opts);
  const banks = bankList(rates);
  const terms = distinctTerms(rates);
  const bankNames = banks.map((b) => b.bank_name);
  const matrix = createRatesMatrix(rates, terms, bankNames);
  const bestRates = calculateBestRates(rates);
  const summaryCards = generateSummaryCards(rates, bestRates);
  const stats = rateStats(rates, banks, terms);
  return {
    latestScrapeAt: latestScrapeAt(opts.rateType),
    rates,
    banks,
    terms,
    matrix,
    bestRates,
    summaryCards,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Calculator data (port of CalculatorController)
// ---------------------------------------------------------------------------

export interface CalculatorData {
  latestScrapeAt: string | null;
  banks: string[]; // full bank_name, lexicographically sorted (matches Rails)
  terms: string[]; // lexicographically sorted (matches Rails dropdown)
  ratesData: Record<string, Record<string, number>>; // bank_name -> term -> rate
}

export function calculatorData(): CalculatorData {
  const scrapedAt = latestScrapeAt("regular");
  if (!scrapedAt) return { latestScrapeAt: null, banks: [], terms: [], ratesData: {} };

  const rows = db()
    .prepare("SELECT * FROM rates WHERE rate_type = 'regular' AND scraped_at = ?")
    .all(scrapedAt) as Rate[];

  const banks = [...new Set(rows.map((r) => r.bank_name))].sort();
  const terms = [...new Set(rows.map((r) => r.term_length))].sort();

  const ratesData: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (ratesData[r.bank_name] ??= {})[r.term_length] = r.interest_rate;
  }

  return { latestScrapeAt: scrapedAt, banks, terms, ratesData };
}

// ---------------------------------------------------------------------------
// Providers (port of ProvidersController + the catch-all route)
// ---------------------------------------------------------------------------

export interface Provider {
  slug: string;
  name: string; // cleaned for display (no trailing dot)
  parentBankName: string; // exact value stored in rates (e.g. "SBS Bank.")
}

/** All provider slugs, derived from distinct regular parent banks. */
export function allProviders(): Provider[] {
  const rows = db()
    .prepare("SELECT DISTINCT parent_bank_name FROM rates WHERE rate_type = 'regular' ORDER BY parent_bank_name")
    .all() as { parent_bank_name: string }[];
  return rows.map((r) => ({
    slug: parameterize(r.parent_bank_name),
    name: cleanBankName(r.parent_bank_name),
    parentBankName: r.parent_bank_name,
  }));
}

export function findProvider(slug: string): Provider | undefined {
  return allProviders().find((p) => p.slug === slug);
}

export interface ProviderProduct {
  name: string; // display name
  rates: Rate[];
  credit_rating: string | null;
  minimum_deposit: number | null;
  matrix: Record<string, Rate | null>;
}

export interface ProviderPageData {
  provider: Provider;
  latestScrapeAt: string | null;
  terms: string[];
  bankInfo: { bank_name: string; credit_rating: string | null; minimum_deposit: number | null };
  products: ProviderProduct[];
  navBanks: { name: string; slug: string }[]; // parent banks for the logo strip
}

export function providerPageData(provider: Provider): ProviderPageData {
  // Latest regular row per (term_length, product_variant) for this parent bank.
  const sql = `
    SELECT r.* FROM rates r
    INNER JOIN (
      SELECT term_length, product_variant, MAX(scraped_at) AS max_scraped_at
      FROM rates
      WHERE rate_type = 'regular' AND parent_bank_name = @name
      GROUP BY term_length, product_variant
    ) latest
      ON r.term_length = latest.term_length
      AND COALESCE(r.product_variant, '') = COALESCE(latest.product_variant, '')
      AND r.scraped_at = latest.max_scraped_at
    WHERE r.rate_type = 'regular' AND r.parent_bank_name = @name
    ORDER BY r.term_length ASC, r.product_variant ASC
  `;
  const rates = db().prepare(sql).all({ name: provider.parentBankName }) as Rate[];

  const terms = distinctTerms(rates);

  // Group by product (display name); sort Freedom variants last.
  const products: ProviderProduct[] = [...groupBy(rates, (r) => displayName(r)).entries()]
    .map(([name, productRates]) => {
      const matrix: Record<string, Rate | null> = {};
      for (const term of terms) matrix[term] = null;
      for (const r of productRates) if (r.term_length in matrix) matrix[r.term_length] = r;
      return {
        name,
        rates: productRates,
        credit_rating: productRates[0].credit_rating,
        minimum_deposit: productRates[0].minimum_deposit,
        matrix,
      };
    })
    .sort((a, b) => {
      const af = a.name.includes("Freedom") ? 1 : 0;
      const bf = b.name.includes("Freedom") ? 1 : 0;
      return af - bf || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });

  const first = rates[0];
  const bankInfo = {
    bank_name: provider.name,
    credit_rating: first?.credit_rating ?? null,
    minimum_deposit: first?.minimum_deposit ?? null,
  };

  // Nav: all parent banks from the latest regular scrape, sorted.
  const scrapedAt = latestScrapeAt("regular");
  const navRows = scrapedAt
    ? (db()
        .prepare(
          "SELECT DISTINCT parent_bank_name FROM rates WHERE rate_type='regular' AND scraped_at=? ORDER BY parent_bank_name"
        )
        .all(scrapedAt) as { parent_bank_name: string }[])
    : [];
  const navBanks = navRows.map((r) => ({ name: cleanBankName(r.parent_bank_name), slug: parameterize(r.parent_bank_name) }));

  return {
    provider,
    latestScrapeAt: scrapedAt,
    terms,
    bankInfo,
    products,
    navBanks,
  };
}
