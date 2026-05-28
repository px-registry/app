// Sale price — supported currencies and display formatting.
//
// A price is stored in the manifest as an integer `amount` in the currency's
// minor unit plus an ISO 4217 `currency` code (see PxPrice), so it canonicalizes
// exactly — no floating-point money ever enters the pack_id preimage. Turning
// that integer back into a human price is a pure, locale-independent function,
// shared by the composer preview and the buyer's view so the two cannot drift,
// and so SSR and client render byte-identical (no Intl locale surprises).

export interface CurrencyMeta {
  /** Fractional digits — yen has none, dollars two. */
  decimals: number;
  /** Leading symbol for display. */
  symbol: string;
}

// JPY default (the home market); USD the one cross-border option for now. The
// set is deliberately minimal — more currencies are a later phase, not a blocker.
export const CURRENCIES: Record<string, CurrencyMeta> = {
  JPY: { decimals: 0, symbol: "¥" },
  USD: { decimals: 2, symbol: "$" },
};

/** The default currency for a new sale (JPY). */
export const DEFAULT_CURRENCY = "JPY";

/** Currency codes in display order (drives the composer's <select>). */
export const CURRENCY_CODES = Object.keys(CURRENCIES);

/**
 * Format an integer minor-unit `amount` for display:
 *   (1200, "JPY") → "¥1,200"   (999, "USD") → "$9.99"
 * Unknown currencies fall back to the bare integer with the code appended.
 * Deterministic and dependency-free.
 */
export function formatPrice(amount: number, currency: string): string {
  const meta = CURRENCIES[currency];
  if (!meta) return `${amount} ${currency}`;
  const negative = amount < 0;
  const abs = Math.abs(Math.trunc(amount));
  const factor = 10 ** meta.decimals;
  const whole = Math.floor(abs / factor);
  const frac = abs % factor;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = meta.decimals
    ? `${grouped}.${frac.toString().padStart(meta.decimals, "0")}`
    : grouped;
  return `${negative ? "-" : ""}${meta.symbol}${body}`;
}

/**
 * Parse the major-unit amount the seller types ("1200", "9.99") into the integer
 * minor-unit amount stored in the manifest, rounded to the currency's precision.
 * Returns 0 for blank or unparseable input (the composer guards sharing on a
 * zero price separately).
 */
export function parsePriceInput(input: string, currency: string): number {
  const meta = CURRENCIES[currency] ?? { decimals: 0, symbol: "" };
  const n = parseFloat(input.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10 ** meta.decimals);
}
