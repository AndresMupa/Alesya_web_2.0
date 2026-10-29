/**
 * Guardián del correo: puntúa el riesgo de cada correo que llega al buzón comercial antes de que entre al CRM.
 * Suma señales independientes (autenticación del remitente, suplantación de la marca, enlaces engañosos, adjuntos
 * peligrosos y textos típicos de phishing, fraude de pagos o premios pagados) y devuelve un nivel:
 * - "dangerous" (60+): cuarentena y aviso al equipo.
 * - "suspicious" (30–59): cuarentena sin aviso; el asesor decide si lo libera.
 * - "ok": sigue el flujo normal de la captación.
 * Es una heurística local: no consulta servicios externos ni abre los enlaces. No reemplaza el filtro antispam del
 * servidor; cubre lo que este deja pasar (correos bien formados de dominios reales que venden o engañan).
 */

export type GuardLink = { href: string; text: string };
export type GuardInput = {
  from: { name: string; address: string } | null;
  replyTo: { name: string; address: string } | null;
  subject: string;
  text: string;
  links: GuardLink[];
  attachments: string[];
  /** Cabeceras en minúsculas; `authentication-results` y `received-spf` deben ser las que añadió nuestro servidor (las de más arriba). */
  headers: Record<string, string>;
  /** Dominios propios (p. ej. alesyaediciones.com) y nombres de marca en minúsculas (p. ej. "alesya"). */
  ownDomains: string[];
  brands: string[];
};
export type GuardSignal = { code: string; label: string; points: number };
export type GuardLevel = "ok" | "suspicious" | "dangerous";
export type GuardResult = { score: number; level: GuardLevel; signals: GuardSignal[] };

export const SUSPICIOUS_FROM = 30;
export const DANGEROUS_FROM = 60;

const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|aol|proton|protonmail|gmx|zoho|mail)\./;
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "cutt.ly", "is.gd", "rb.gy", "shorturl.at", "ow.ly", "tiny.cc", "t.ly", "s.id", "rebrand.ly", "buff.ly", "lnkd.in", "t.co", "goo.gl"]);
/** Redirecciones de seguimiento de las plataformas de envío masivo: cambian el destino aparente sin ser un engaño. */
const TRACKERS = /(^|\.)(sendgrid\.net|list-manage\.com|mailchimp\.com|mcusercontent\.com|hubspotlinks\.com|hubspotemail\.net|hs-sites\.com|mailgun\.org|mandrillapp\.com|rs6\.net|mlsend\.com|sendibt\d*\.com|brevo\.com|sendinblue\.com|mailjet\.com|amazonses\.com|awstrack\.me|safelinks\.protection\.outlook\.com|google\.com|doubleclick\.net)$|^(click|clicks|links?|track(ing)?|email|e|go|url\d*)\./;
const EXECUTABLE = /\.(exe|scr|js|jse|vbs|vbe|wsf|wsh|bat|cmd|com|pif|msi|msp|hta|lnk|iso|img|vhdx?|jar|ps1|psm1|cpl|reg|appx|msix|dll)$/;
const HTML_FILE = /\.(html?|shtml|xhtml|svg|mht|mhtml)$/;
const MACRO_FILE = /\.(docm|dotm|xlsm|xltm|xlam|pptm|potm|ppam|sldm)$/;
const ARCHIVE = /\.(zip|rar|7z|gz|tgz|tar|ace|cab|arj|lzh|z)$/;

/** Texto comparable: minúsculas, sin tildes y con espacios simples. */
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();
const hostOf = (href: string) => { try { return new URL(href).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
/** Dominio registrable aproximado: las dos últimas etiquetas, o tres si es un dominio de país de segundo nivel (com.co, edu.co…). */
export function baseDomain(host: string) {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  const take = labels.length >= 3 && /^(com|edu|gov|gob|org|net|co|ac|mil)$/.test(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
  return labels.slice(-take).join(".");
}
const nameOf = (domain: string) => baseDomain(domain).split(".")[0];
const isOwnDomain = (domain: string, own: string[]) => own.some((item) => domain === item || domain.endsWith(`.${item}`));

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

/** Resultado de un método en Authentication-Results / Received-SPF: "pass", "fail", "softfail"… o null si no aparece. */
function authResult(headers: Record<string, string>, method: "spf" | "dkim" | "dmarc") {
  const results = headers["authentication-results"] ?? "";
  const match = results.match(new RegExp(`\\b${method}\\s*=\\s*([a-z]+)`, "i"));
  if (match) return match[1].toLowerCase();
  if (method === "spf") return (headers["received-spf"] ?? "").match(/^\s*([a-z]+)/i)?.[1].toLowerCase() ?? null;
  return null;
}

/** Enlaces de un HTML de correo: destino y texto visible (sin etiquetas). */
export function extractLinks(html: string, limit = 200): GuardLink[] {
  const links: GuardLink[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ href: match[2].replace(/&amp;/g, "&").trim(), text: match[3].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() });
    if (links.length >= limit) break;
  }
  return links;
}

/** Direcciones escritas en un texto plano. */
export function extractUrls(text: string, limit = 200): GuardLink[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].slice(0, limit).map((match) => ({ href: match[0].replace(/[.,;:!?]+$/, ""), text: "" }));
}

const CONTENT_RULES: { code: string; label: string; points: number; test: (text: string) => boolean }[] = [
  {
    code: "credentials", label: "Pide verificar la cuenta, el buzón o la contraseña", points: 30,
    test: (t) => /\b(verifi|confirm|valid|actualiz|reactiv|desbloque)\w* (tu|su|your|the) (cuenta|correo|buzon|contrasena|clave|acceso|account|password|mailbox|email)|\b(contrasena|password|clave) (vence|expir|caduc|will expire)|\bbuzon (lleno|excedi|sin espacio)|\bmailbox (is )?(full|quota|storage)|\b(cuenta|account|correo|mailbox) (sera |will be |ha sido |has been )?(suspend|bloque|desactiv|cerrad|deactivat|disabled)|\b(inicia|iniciar) sesion para (ver|confirmar|descargar|evitar)|\bsign in to (view|confirm|download|keep)|\b(te|le) (han )?compartido un documento|\bshared (a )?(document|file) with you/.test(t),
  },
  {
    code: "payment", label: "Pide pagos urgentes o cambia datos bancarios", points: 30,
    test: (t) => /\b(cambi|actualiz|nuev)\w* (de )?(los |la |nuestra |nuestros )?(cuenta|datos|informacion) bancari|\bnueva cuenta (bancaria|para (el |realizar el )?pago)|\btransferencia (urgente|inmediata|hoy)|\bwire transfer|\bbank (details|account) (have |has )?(changed|updated)|\btarjetas? de regalo|\bgift ?cards?|\bfactura (vencida|pendiente|impagada)\b.*\b(enlace|adjunt|link)|\b(pago|payment) (pendiente|overdue|pending)\b.*\b(hoy|today|24 horas|24 hours)/.test(t),
  },
  {
    code: "extortion", label: "Extorsión o pago en criptomonedas", points: 40,
    test: (t) => /\b(bitcoin|btc wallet|billetera (de )?bitcoin|monedero bitcoin|usdt|criptomoneda)\b|\b(i have hacked|hackee tu|tengo acceso a tu (dispositivo|correo|camara)|grabe un video|recorded you)/.test(t),
  },
  {
    code: "award", label: "Premio o nominación no solicitada (suelen vender paquetes o placas pagadas)", points: 35,
    // Exige las dos partes (premio + invitación a aceptarlo o a comprar extras) para no tocar a un colegio que habla de sus premios.
    test: (t) => /\b(nominat\w*|nominee|nominacion|nominad[oa]s?|awards?|awardees?|premios?|galardon\w*|shortlist\w*)\b/.test(t)
      && /\b(accept (your |the )?nomination|aceptar (la |su |tu )?nominacion|acepte (la |su )?nominacion|claim (your )?(award|place|trophy)|reclam\w* (su |tu )?(premio|galardon|reconocimiento)|join the shortlist|promotional (extras|package|options)|paquete promocional|optional extras|winners? (logo|badge)|trophy|trofeo|placa conmemorativa|press release package)\b/.test(t),
  },
  {
    code: "domain", label: "Venta o renovación de dominios con presión", points: 30,
    test: (t) => /\b(registrar|register|registro de|registration of)\b.{0,80}\b(dominio|domain|marca|brand|keyword)s?\b.{0,160}\b(otra empresa|another company|third party|tercero|conflict|conflicto)|\b(dominio|domain)\b.{0,60}\b(expir|vence|renew|renov)\w*.{0,80}\b(hoy|today|immediately|inmediat|urgent)/.test(t),
  },
  {
    code: "urgency", label: "Presión de tiempo o amenaza", points: 10,
    test: (t) => /\b(urgente|de inmediato|inmediatamente|en las proximas \d+ horas|within \d+ hours|ultimo aviso|final notice|act now|de lo contrario|otherwise your|immediately)\b/.test(t),
  },
];

/** Evalúa un correo. Puntaje de 0 a 100. */
export function assessEmail(input: GuardInput): GuardResult {
  const signals: GuardSignal[] = [];
  const add = (code: string, label: string, points: number) => { if (!signals.some((signal) => signal.code === code)) signals.push({ code, label, points }); };
  const own = input.ownDomains.map((domain) => domain.toLowerCase());
  const brands = input.brands.map(normalize).filter((brand) => brand.length >= 4);
  const fromDomain = input.from ? domainOf(input.from.address) : "";
  const fromOwn = Boolean(fromDomain) && isOwnDomain(fromDomain, own);

  // 1. Autenticación del remitente según nuestro servidor de correo.
  const dmarc = authResult(input.headers, "dmarc"), spf = authResult(input.headers, "spf"), dkim = authResult(input.headers, "dkim");
  const authFailed = dmarc === "fail" || spf === "fail";
  if (fromOwn && authFailed) add("spoof-own", "Usa nuestro propio dominio sin autorización (suplantación)", 60);
  if (dmarc === "fail") add("dmarc", "DMARC falló: el dominio del remitente no autoriza este envío", 45);
  if (spf === "fail") add("spf", "SPF falló: el servidor que lo envió no es del dominio del remitente", 25);
  else if (spf === "softfail") add("spf", "SPF dudoso (softfail) para el dominio del remitente", 10);
  if (dkim === "fail" && !/\bdkim\s*=\s*pass/i.test(input.headers["authentication-results"] ?? "")) add("dkim", "La firma DKIM no es válida (el mensaje pudo alterarse)", 15);
  const spam = input.headers["x-spam-status"] ?? "";
  const spamScore = Number((spam.match(/score=(-?[\d.]+)/i) ?? input.headers["x-spam-score"]?.match(/(-?[\d.]+)/) ?? [])[1]);
  if (/^yes/i.test(spam) || spamScore >= 5) add("spamassassin", `El filtro antispam del servidor lo calificó como spam${Number.isFinite(spamScore) ? ` (${spamScore})` : ""}`, 20);

  // 2. Suplantación de la marca.
  if (fromDomain && !fromOwn) {
    const name = nameOf(fromDomain);
    const lookalike = own.some((domain) => { const ownName = nameOf(domain); return name !== ownName && (distance(name, ownName) <= 2 || name.includes(ownName)); }) || brands.some((brand) => normalize(fromDomain).includes(brand));
    if (lookalike) add("lookalike", `El dominio ${fromDomain} imita al nuestro`, 50);
    const display = normalize(input.from?.name ?? "");
    if (brands.some((brand) => display.includes(brand)) || own.some((domain) => display.includes(domain))) add("brand-name", "Se presenta con el nombre de Alesya desde un correo externo", 30);
    const shown = display.match(/[^\s<>"']+@[^\s<>"']+/)?.[0];
    if (shown && shown !== input.from?.address) add("display-address", `El nombre visible muestra otra dirección (${shown})`, 20);
  }
  if (input.replyTo && input.from && domainOf(input.replyTo.address) !== fromDomain && FREE_MAIL.test(domainOf(input.replyTo.address)) && !FREE_MAIL.test(fromDomain)) {
    add("reply-to", `Las respuestas irían a otra dirección (${input.replyTo.address})`, 15);
  }

  // 3. Enlaces.
  for (const link of input.links) {
    const host = hostOf(link.href);
    if (!host) continue;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) add("link-ip", "Tiene enlaces a una dirección IP en lugar de un dominio", 25);
    if (host.split(".").some((label) => label.startsWith("xn--"))) add("link-punycode", "Tiene enlaces con caracteres que imitan letras (punycode)", 20);
    if (SHORTENERS.has(host)) add("link-shortener", "Tiene enlaces acortados que ocultan el destino", 10);
    if (own.some((domain) => nameOf(host) !== nameOf(domain) && distance(nameOf(host), nameOf(domain)) <= 2)) add("link-lookalike", `Tiene enlaces a ${host}, parecido a nuestro dominio`, 40);
    const shown = link.text.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[/\s]|$)/i)?.[1].toLowerCase().replace(/^www\./, "");
    if (shown && !shown.includes("@") && baseDomain(shown) !== baseDomain(host) && !TRACKERS.test(host) && baseDomain(host) !== baseDomain(fromDomain || "-")) {
      add("link-mismatch", `Un enlace muestra ${shown} pero lleva a ${host}`, 25);
    }
  }

  // 4. Adjuntos.
  for (const file of input.attachments.map((name) => name.toLowerCase().trim())) {
    if (EXECUTABLE.test(file)) add("attach-exec", `Adjunto ejecutable (${file})`, 50);
    else if (HTML_FILE.test(file)) add("attach-html", `Adjunto HTML que suele imitar páginas de inicio de sesión (${file})`, 35);
    else if (MACRO_FILE.test(file)) add("attach-macro", `Documento con macros (${file})`, 30);
    else if (ARCHIVE.test(file)) add("attach-archive", `Archivo comprimido adjunto (${file})`, 15);
    if (/\.(pdf|docx?|xlsx?|jpe?g|png|txt)\.[a-z0-9]{2,5}$/.test(file)) add("attach-double", "Adjunto con doble extensión", 20);
  }

  // 5. Contenido (asunto y cuerpo).
  const text = normalize(`${input.subject}\n${input.text.slice(0, 20_000)}`);
  for (const rule of CONTENT_RULES) if (rule.test(text)) add(rule.code, rule.label, rule.points);
  // La urgencia sola no basta: solo cuenta junto con otra señal.
  if (signals.length === 1 && signals[0].code === "urgency") signals.length = 0;

  signals.sort((a, b) => b.points - a.points);
  const score = Math.min(100, signals.reduce((total, signal) => total + signal.points, 0));
  return { score, level: score >= DANGEROUS_FROM ? "dangerous" : score >= SUSPICIOUS_FROM ? "suspicious" : "ok", signals };
}
