import type { Locale } from "./i18n";

/* ---------------------------------------------------------------------------
 * Locale formatting for dates, times and decimals.
 *
 * English shows UK time (the fixtures' own clock); Finnish shows Finnish time
 * with the Finnish conventions — 12.30 for times, commas for decimals.
 * Date-only strings (round ids like "2026-10-10") are read at UTC noon so no
 * time zone can shift them across midnight.
 * ------------------------------------------------------------------------- */

const TZ: Record<Locale, string> = { en: "Europe/London", fi: "Europe/Helsinki" };

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : new Date(v);
}

// Fixed English abbreviations — ICU's en-GB gives "Sept", the design uses "Sep".
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(v: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions) {
  const wantShort = locale === "en" && opts.month === "short";
  const p = new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
    timeZone: TZ[locale], ...opts, ...(wantShort ? { month: "numeric" } : {}),
  }).formatToParts(toDate(v));
  const out = Object.fromEntries(p.map((x) => [x.type, x.value])) as Record<string, string>;
  if (wantShort) out.month = EN_MONTHS[Number(out.month) - 1];
  if (out.day) out.day = String(Number(out.day));
  return out;
}

/** en "10 Oct 2026" · fi "10.10.2026" */
export function fmtDate(v: string | Date, locale: Locale): string {
  const p = parts(v, locale, { day: "numeric", month: locale === "fi" ? "numeric" : "short", year: "numeric" });
  return locale === "fi" ? `${p.day}.${p.month}.${p.year}` : `${p.day} ${p.month} ${p.year}`;
}

/** en "22 Aug" · fi "22.8." */
export function fmtShortDate(v: string | Date, locale: Locale): string {
  const p = parts(v, locale, { day: "numeric", month: locale === "fi" ? "numeric" : "short" });
  return locale === "fi" ? `${p.day}.${p.month}.` : `${p.day} ${p.month}`;
}

/** en "10 October" · fi "10.10." */
export function fmtLongDate(v: string | Date, locale: Locale): string {
  const p = parts(v, locale, { day: "numeric", month: locale === "fi" ? "numeric" : "long" });
  return locale === "fi" ? `${p.day}.${p.month}.` : `${p.day} ${p.month}`;
}

/** en "Sat 17 Oct" · fi "la 17.10." */
export function fmtDay(v: string | Date, locale: Locale): string {
  const p = parts(v, locale, { weekday: "short", day: "numeric", month: locale === "fi" ? "numeric" : "short" });
  return locale === "fi" ? `${p.weekday} ${p.day}.${p.month}.` : `${p.weekday} ${p.day} ${p.month}`;
}

/** en "10:30" (UK) · fi "12.30" (Finland) */
export function fmtTime(v: string | Date, locale: Locale): string {
  const p = parts(v, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}${locale === "fi" ? "." : ":"}${p.minute}`;
}

/** Fixed decimals, with a comma in Finnish. */
export function fmtDec(n: number, digits: number, locale: Locale): string {
  const s = n.toFixed(digits);
  return locale === "fi" ? s.replace(".", ",") : s;
}

/** A duration as "4 h 30 min" (same in both locales). */
export function fmtLead(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** ISO timestamp without milliseconds: 2026-10-10T09:30:00Z */
export function fmtStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The UTC instant of a wall-clock time on a date in a given zone. */
export function zonedInstant(date: string, hh: number, mm: number, timeZone: string): Date {
  const guess = new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(guess).map((x) => [x.type, x.value]),
  );
  const offsetMin = (Number(p.hour) * 60 + Number(p.minute)) - (hh * 60 + mm);
  return new Date(guess.getTime() - offsetMin * 60000);
}

/** "2026-10-10" + n days, as a date string. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
