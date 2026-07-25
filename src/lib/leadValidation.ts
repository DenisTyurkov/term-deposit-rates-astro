// Copied verbatim from nz-leads src/lib/leadValidation.ts (with types added) —
// the lead intake endpoint applies exactly these rules, so anything the client
// accepts, the server accepts. Keep in sync if that file changes.

export function isValidEmail(email: string): boolean {
  // Simple RFC 5322 compliant regex
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function normalizePhone(phone: string): string {
  if (typeof phone !== "string") return "";
  let normalized = phone.replace(/[\s\-().]/g, "");
  if (normalized.startsWith("+64")) normalized = "0" + normalized.slice(3);
  else if (normalized.startsWith("0064")) normalized = "0" + normalized.slice(4);
  return normalized;
}

export function isValidPhone(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(normalizePhone(phone));
}
