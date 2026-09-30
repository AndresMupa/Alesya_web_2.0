// Formatos compartidos por la tienda, el CRM y el panel. Seguro para cliente y servidor.

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const copCompact = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });

export const formatMoney = (cents: number) => cop.format(Math.round(cents) / 100);
export const formatMoneyCompact = (cents: number) => copCompact.format(Math.round(cents) / 100);
export const formatDateTime = (value: Date | number | string) => dateTime.format(new Date(value));

/** `YYYY-MM-DD` (fechas de seguimiento guardadas como texto) → "3 oct". */
export function formatDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** Fecha de hoy en Colombia como `YYYY-MM-DD`, con desplazamiento opcional en días. */
export function bogotaDay(offsetDays = 0, now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now + offsetDays * 86_400_000));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
/** Inicio del mes actual (offset 0) o de meses anteriores en Colombia (UTC-5, sin horario de verano). */
export function bogotaMonthStart(offsetMonths = 0, now = Date.now()) {
  const local = new Date(now - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offsetMonths, 1) + BOGOTA_OFFSET_MS);
}

export const plural = (value: number, one: string, many: string) => `${value.toLocaleString("es-CO")} ${value === 1 ? one : many}`;

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Enlace de WhatsApp a un número colombiano. Acepta varios separados por `;` y elige el primer celular
 * (10 dígitos que empiezan por 3, con o sin +57); los fijos no sirven para WhatsApp.
 */
export function whatsappLink(phone: string | null | undefined, text = "") {
  const candidates = (phone ?? "").split(/[;,/]/).map((value) => value.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, ""));
  const mobile = candidates.find((digits) => /^3\d{9}$/.test(digits)) ?? candidates.find((digits) => digits.length > 10);
  if (!mobile) return null;
  const number = mobile.length === 10 ? `57${mobile}` : mobile;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
