-- Term deposit rates store (committed SQLite file, read at build time).
--
-- Append-history model (per MIGRATION.md): every scrape INSERTs new rows
-- stamped with `scraped_at`. Pages read "latest row per bank/term". There is
-- deliberately NO unique index on (bank_name, term_length, rate_type) — that
-- index is what forced upsert-in-place in the old Rails app and prevented the
-- history MIGRATION.md always intended to keep.

CREATE TABLE IF NOT EXISTS rates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_name       TEXT    NOT NULL,
  parent_bank_name TEXT   NOT NULL,
  product_variant TEXT,
  term_length     TEXT    NOT NULL,
  interest_rate   REAL    NOT NULL,
  credit_rating   TEXT,
  minimum_deposit INTEGER,          -- stored in cents (×100), as in Rails
  credit_code     TEXT,
  paid_code       TEXT,
  rate_type       TEXT    NOT NULL DEFAULT 'regular',  -- 'regular' | 'pie'
  scraped_at      TEXT    NOT NULL  -- ISO-8601 UTC; one value per scrape run
);

CREATE INDEX IF NOT EXISTS index_rates_on_parent_bank_name
  ON rates (parent_bank_name);
CREATE INDEX IF NOT EXISTS index_rates_on_rate_type
  ON rates (rate_type);
CREATE INDEX IF NOT EXISTS index_rates_on_bank_term_type
  ON rates (bank_name, term_length, rate_type);
CREATE INDEX IF NOT EXISTS index_rates_on_scraped_at
  ON rates (scraped_at);
