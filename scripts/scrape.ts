/**
 * Scraper for interest.co.nz term-deposit tables.
 *
 * TypeScript/cheerio port of the Rails `Scrapers::InterestCoNz` (Nokogiri).
 * Preserves: the column-index maps, bank-name normalization, parent/variant
 * extraction, minimum-deposit parsing (stored in cents), the term-from-account
 * -name logic, and both the regular + PIE scraping paths — including the
 * Nokogiri table-finding fallbacks.
 *
 * Append-history model: each run INSERTs new rows stamped with a single
 * `scraped_at` for the whole run. Pages read "latest row per bank/term".
 *
 * Usage:
 *   npx tsx scripts/scrape.ts            # scrape + write into db/rates.db
 *   npx tsx scripts/scrape.ts --dry-run  # scrape + print summary, write nothing
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "db", "rates.db");
const SCHEMA_PATH = join(ROOT, "db", "schema.sql");

const LONG_TERM_URL = "https://www.interest.co.nz/saving/term-deposits-1-to-5-years";
const SHORT_TERM_URL = "https://www.interest.co.nz/saving/term-deposits-1-to-9-months";
const PIE_URL = "https://www.interest.co.nz/saving/term-pie";

// Column index (0-based <td>) → term label.
const LONG_TERM_COLUMNS: Record<number, string> = {
  5: "12 mths",
  6: "18 mths",
  7: "2 years",
  8: "3 years",
  9: "4 years",
  10: "5 years",
};

const SHORT_TERM_COLUMNS: Record<number, string> = {
  5: "1 month",
  6: "3 months",
  7: "4 months",
  8: "5 months",
  9: "6 months",
  10: "9 months",
};

export type RateRecord = {
  bank_name: string;
  parent_bank_name: string;
  product_variant: string | null;
  term_length: string;
  interest_rate: number;
  credit_rating: string | null;
  minimum_deposit: number | null;
  credit_code: string | null;
  paid_code: string | null;
  rate_type: "regular" | "pie";
};

type BankName = { parent_bank: string; product_variant: string | null };

// ---------------------------------------------------------------------------
// Parsing helpers (ports of the Ruby private methods)
// ---------------------------------------------------------------------------

function extractText($cell: Cheerio<Element>): string {
  return $cell.text().trim();
}

function parseRate(rateText: string): number | null {
  const value = parseFloat(rateText.replace(/%/g, ""));
  return Number.isNaN(value) ? null : value;
}

function parseMinimumDeposit(depositText: string): number | null {
  if (!depositText || depositText === "-") return null;
  const cleaned = depositText.replace(/[$,]/g, "");
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.trunc(value * 100); // store in cents, as Rails did
}

function extractParentAndVariant(bankName: string): BankName | null {
  if (!bankName || !bankName.trim()) return null;

  // Known product patterns extracted as variants (order matters, first wins).
  const productPatterns: RegExp[] = [
    /^(.*?)\s+(Freedom 60)$/i,
    /^(.*?)\s+(PIE)$/i,
    /^(.*?)\s+(Online)$/i,
    /^(.*?)\s+(Bonus Saver)$/i,
  ];

  let parentBank = bankName;
  let productVariant: string | null = null;

  for (const pattern of productPatterns) {
    const match = bankName.match(pattern);
    if (match) {
      parentBank = match[1].trim();
      productVariant = match[2].trim();
      break;
    }
  }

  return { parent_bank: parentBank, product_variant: productVariant };
}

function normalizeBankName(bankName: string | null): BankName | null {
  if (!bankName || !bankName.trim()) return null;

  const nameMapping: Record<string, string> = {
    RaboDirect: "Rabobank",
    // interest.co.nz changed Rabobank's logo alt from "RaboDirect" to
    // "Rabobank." (trailing dot). Map it back to the dot-less name the Rails
    // app stored so display/logo/grouping stay identical. (SBS is left as
    // "SBS Bank." — that trailing dot is already how the live site shows it.)
    "Rabobank.": "Rabobank",
  };

  const normalized = nameMapping[bankName] ?? bankName;
  return extractParentAndVariant(normalized);
}

function extractBankName($: CheerioAPI, $cell: Cheerio<Element>): BankName | null {
  // Prefer the bank name from the logo's alt text; fall back to cell text.
  const img = $cell.find("img").first();
  const alt = img.attr("alt");
  let bankName: string | null;
  if (img.length && alt && alt.trim()) {
    bankName = alt.trim();
  } else {
    const text = $cell.text().trim();
    bankName = text ? text : null;
  }

  return normalizeBankName(bankName);
}

function extractPieBankName($cell: Cheerio<Element>): BankName | null {
  // PIE bank name is usually a text link; strip stray brackets.
  const text = $cell.text().trim().replace(/[\[\]]/g, "").trim();
  return normalizeBankName(text);
}

function extractTermFromAccountName(accountName: string): string | null {
  if (!accountName || !accountName.trim()) return null;

  // "Term PIE - 3 months", "Term PIE - 1 year", "Term PIE - 18 months", ...
  const match = accountName.match(/(\d+)\s+(month|year)s?/i);
  if (!match) return null;

  const number = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit === "month") {
    if (number === 12) return "12 mths"; // match regular-rates format
    if (number === 18) return "18 mths"; // match regular-rates format
    return `${number} ${number === 1 ? "month" : "months"}`;
  }
  // unit === "year"
  return `${number} ${number === 1 ? "year" : "years"}`;
}

function fullBankName(bank: BankName): string {
  return bank.product_variant
    ? `${bank.parent_bank} ${bank.product_variant}`
    : bank.parent_bank;
}

// ---------------------------------------------------------------------------
// Table finding (ports of the Nokogiri xpath + fallbacks)
// ---------------------------------------------------------------------------

/** Document-ordered list of every element, used to compare positions. */
function documentOrder($: CheerioAPI): Element[] {
  return $("*").toArray() as Element[];
}

/** Find the "Banks" rates table, mirroring the Ruby fallback chain. */
function findRegularTable($: CheerioAPI): Element | null {
  const order = documentOrder($);

  const heading = $("h2, h3")
    .toArray()
    .find((el) => /Banks/.test($(el).text())) as Element | undefined;

  const tables = $("table").toArray() as Element[];

  if (heading) {
    const headingIdx = order.indexOf(heading);
    // 1) first table that appears after the "Banks" heading in document order
    const after = tables.find((t) => order.indexOf(t) > headingIdx);
    if (after) return after;
  }

  // 2) fallback: first table on the page (Ruby: doc.xpath("//table").first)
  return tables[0] ?? null;
}

/** Find the PIE table: the table whose headers mention issuer/advertised. */
function findPieTable($: CheerioAPI): Element | null {
  const tables = $("table").toArray() as Element[];
  return (
    tables.find((t) => {
      const headers = $(t)
        .find("th")
        .toArray()
        .map((th) => $(th).text().toLowerCase());
      return headers.some((h) => h.includes("issuer") || h.includes("advertised"));
    }) ?? null
  );
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function extractRegularRates(html: string, termColumns: Record<number, string>): RateRecord[] {
  const $ = cheerio.load(html);
  const rates: RateRecord[] = [];

  const table = findRegularTable($);
  if (!table) return rates;

  const rows = $(table).find("tbody tr").toArray() as Element[];

  for (const row of rows) {
    const cells = $(row).find("td").toArray() as Element[];
    if (cells.length < 11) continue;

    const bank = extractBankName($, $(cells[0]));
    if (!bank || !bank.parent_bank) continue;

    const creditRating = extractText($(cells[1]));
    const minimumDeposit = parseMinimumDeposit(extractText($(cells[2])));
    const creditCode = extractText($(cells[3]));
    const paidCode = extractText($(cells[4]));

    for (const [indexStr, termLength] of Object.entries(termColumns)) {
      const columnIndex = Number(indexStr);
      const rateText = extractText($(cells[columnIndex]));
      if (!rateText || rateText === "-") continue;

      const interestRate = parseRate(rateText);
      if (interestRate === null) continue;

      rates.push({
        bank_name: fullBankName(bank),
        parent_bank_name: bank.parent_bank,
        product_variant: bank.product_variant,
        term_length: termLength,
        interest_rate: interestRate,
        credit_rating: creditRating || null,
        minimum_deposit: minimumDeposit,
        credit_code: creditCode || null,
        paid_code: paidCode || null,
        rate_type: "regular",
      });
    }
  }

  return rates;
}

function extractPieRates(html: string): RateRecord[] {
  const $ = cheerio.load(html);
  const rates: RateRecord[] = [];

  const table = findPieTable($);
  if (!table) return rates;

  const rows = $(table).find("tbody tr").toArray() as Element[];
  let currentBank: BankName | null = null;

  for (const row of rows) {
    const cells = $(row).find("td").toArray() as Element[];
    if (cells.length < 6) continue;

    const firstCellText = extractText($(cells[0]));
    if (firstCellText) {
      // New bank row
      currentBank = extractPieBankName($(cells[0]));
      if (!currentBank || !currentBank.parent_bank) continue;
    } else if (!currentBank) {
      // Row with no bank context yet
      continue;
    }

    const accountName = extractText($(cells[1]));
    const minimumDeposit = parseMinimumDeposit(extractText($(cells[2])));
    const interestRateText = extractText($(cells[5])); // "Advertised Rate % p.a."

    if (!interestRateText || interestRateText === "-") continue;

    const interestRate = parseRate(interestRateText);
    if (interestRate === null) continue;

    const termLength = extractTermFromAccountName(accountName);
    if (!termLength) continue;

    const bank = currentBank!;
    rates.push({
      bank_name: fullBankName(bank),
      parent_bank_name: bank.parent_bank,
      product_variant: bank.product_variant,
      term_length: termLength,
      interest_rate: interestRate,
      credit_rating: null,
      minimum_deposit: minimumDeposit,
      credit_code: null,
      paid_code: null,
      rate_type: "pie",
    });
  }

  return rates;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // interest.co.nz blocks default fetch UA; mimic a browser.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  // Keep a rollback journal (not WAL) so the committed db/rates.db has no
  // lingering -wal/-shm sidecar files to track in git.
  db.pragma("journal_mode = DELETE");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

function insertRates(db: Database.Database, rates: RateRecord[], scrapedAt: string): number {
  const stmt = db.prepare(
    `INSERT INTO rates
       (bank_name, parent_bank_name, product_variant, term_length, interest_rate,
        credit_rating, minimum_deposit, credit_code, paid_code, rate_type, scraped_at)
     VALUES
       (@bank_name, @parent_bank_name, @product_variant, @term_length, @interest_rate,
        @credit_rating, @minimum_deposit, @credit_code, @paid_code, @rate_type, @scraped_at)`
  );
  const insertMany = db.transaction((rows: RateRecord[]) => {
    for (const row of rows) stmt.run({ ...row, scraped_at: scrapedAt });
    return rows.length;
  });
  return insertMany(rates);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function scrape(): Promise<RateRecord[]> {
  console.log(`Scraping long-term rates from ${LONG_TERM_URL}...`);
  const longHtml = await fetchHtml(LONG_TERM_URL);
  const longRates = extractRegularRates(longHtml, LONG_TERM_COLUMNS);

  console.log(`Scraping short-term rates from ${SHORT_TERM_URL}...`);
  const shortHtml = await fetchHtml(SHORT_TERM_URL);
  const shortRates = extractRegularRates(shortHtml, SHORT_TERM_COLUMNS);

  console.log(`Scraping PIE rates from ${PIE_URL}...`);
  const pieHtml = await fetchHtml(PIE_URL);
  const pieRates = extractPieRates(pieHtml);

  console.log(
    `Extracted — long-term: ${longRates.length}, short-term: ${shortRates.length}, ` +
      `PIE: ${pieRates.length}`
  );

  return [...longRates, ...shortRates, ...pieRates];
}

function summarize(rates: RateRecord[]): void {
  const regular = rates.filter((r) => r.rate_type === "regular");
  const pie = rates.filter((r) => r.rate_type === "pie");
  const banks = [...new Set(rates.map((r) => r.parent_bank_name))].sort();
  const terms = [...new Set(rates.map((r) => r.term_length))];

  console.log(`\nTotal: ${rates.length} rows (regular ${regular.length}, pie ${pie.length})`);
  console.log(`Banks (${banks.length}): ${banks.join(", ")}`);
  console.log(`Terms (${terms.length}): ${terms.join(", ")}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rates = await scrape();

  if (rates.length === 0) {
    console.error("No rates extracted — aborting (selectors may have changed).");
    process.exitCode = 1;
    return;
  }

  summarize(rates);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const scrapedAt = new Date().toISOString();
  const db = openDb();
  const inserted = insertRates(db, rates, scrapedAt);
  db.close();
  console.log(`\nInserted ${inserted} rows into ${DB_PATH} (scraped_at=${scrapedAt}).`);
}

// Run when invoked directly.
main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exitCode = 1;
});
