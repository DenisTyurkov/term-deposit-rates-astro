/**
 * Bank logo resolution — port of RatesHelper#bank_logo_path / bank_logo_tag.
 *
 * Maps a parent bank name to its logo file (keys match the parent_bank_name
 * values exactly, including "SBS Bank." with its trailing dot and "Rabobank").
 * Images live in src/assets/banks and are imported via import.meta.glob so
 * Astro fingerprints/serves them.
 */

import type { ImageMetadata } from "astro";

// Eagerly import every bank logo as an ImageMetadata.
const modules = import.meta.glob<ImageMetadata>("/src/assets/banks/*.{png,webp,svg}", {
  eager: true,
  import: "default",
});

const byFile: Record<string, ImageMetadata> = {};
for (const [path, mod] of Object.entries(modules)) {
  const file = path.split("/").pop()!;
  byFile[file] = mod;
}

// parent bank name → logo filename (mirrors the Rails logo_map)
const LOGO_FILES: Record<string, string> = {
  ANZ: "ANZ.png",
  ASB: "ASB.webp",
  BNZ: "BNZ.png",
  "Bank of Baroda": "Bank_of_Baroda.svg",
  "Bank of China": "Bank_of_China.png",
  "Bank of India": "Bank_of_India.png",
  "China Construction Bank": "China_Construction_Bank.png",
  "Co-operative Bank": "Co-operative_Bank.png",
  "Heartland Bank": "Heartland_Bank_logo.svg",
  ICBC: "ICBC.png",
  Kiwibank: "Kiwibank.png",
  Rabobank: "RaboDirect.svg",
  "SBS Bank.": "SBS_Bank.png",
  "TSB Bank": "TSB_Bank.png",
  Westpac: "Westpac.png",
};

const VARIANTS = ["Freedom 60", "PIE", "Online", "Bonus Saver"];

/** Strip a known product variant suffix to get the parent bank name. */
function extractParentBank(name: string): string {
  let n = name;
  for (const v of VARIANTS) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    n = n.replace(new RegExp(`\\s+${escaped}$`, "i"), "").trim();
  }
  return n;
}

/** Returns the logo image (or null) for a bank/display name. */
export function logoFor(name: string): ImageMetadata | null {
  const parent = extractParentBank(name);
  // Try the exact parent name, then a trailing-dot-stripped variant so both
  // "SBS Bank." (as stored) and "SBS Bank" (cleaned for display) resolve.
  const file = LOGO_FILES[parent] ?? LOGO_FILES[parent.replace(/\.+$/, "")];
  if (!file) return null;
  return byFile[file] ?? null;
}
