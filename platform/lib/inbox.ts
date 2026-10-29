import "server-only";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import { extractLinks, extractUrls, type GuardLink } from "@/lib/mail-guard";

/**
 * Lectura del buzón comercial por IMAP (en cPanel: una cuenta de correo del dominio, puerto 993). Solo lee: abre
 * el buzón en modo de lectura, así que no marca mensajes como leídos, no los mueve ni los borra.
 *
 * Variables: IMAP_USER (activa la captación), IMAP_PASS, IMAP_HOST, IMAP_PORT (993 SSL) e IMAP_MAILBOX (INBOX).
 * Si IMAP_USER es la misma cuenta que SMTP_USER, sin IMAP_HOST ni IMAP_PASS se usan SMTP_HOST y SMTP_PASS.
 */
function inboxConfig() {
  const env = process.env;
  const user = env.IMAP_USER?.trim() || null;
  const sameAccount = Boolean(user && user.toLowerCase() === env.SMTP_USER?.trim().toLowerCase());
  const host = env.IMAP_HOST?.trim() || (sameAccount ? env.SMTP_HOST?.trim() : undefined) || null;
  const pass = env.IMAP_PASS || (sameAccount ? env.SMTP_PASS : undefined) || null;
  return { configured: Boolean(user && host && pass), user, host, port: Number(env.IMAP_PORT) || 993, mailbox: env.IMAP_MAILBOX?.trim() || "INBOX", pass };
}

/** Estado del buzón para el panel (sin la contraseña). */
export function inboxStatus() {
  const { configured, user, host, port, mailbox } = inboxConfig();
  return { configured, user, host, port, mailbox };
}

export type InboxAddress = { name: string; address: string };
export type InboundMessage = {
  uid: number; messageId: string; date: Date | null; subject: string;
  from: InboxAddress | null; replyTo: InboxAddress | null;
  /** Solo las cabeceras que sirven para reconocer envíos automáticos, spam y la autenticación del remitente, en minúsculas. */
  headers: Record<string, string>;
  /** Cuerpo en texto plano (de la parte text/plain o, si no hay, del HTML), hasta ~64 KB. */
  text: string;
  /** Enlaces del HTML (destino y texto visible) o, si no hay HTML, las direcciones escritas en el texto. Para el guardián. */
  links: GuardLink[];
  /** Nombres de los archivos adjuntos (no se descargan). */
  attachments: string[];
};

const CLASSIFY_HEADERS = ["auto-submitted", "precedence", "list-id", "list-unsubscribe", "x-autoreply", "x-autorespond", "x-spam-flag", "x-spam-status", "x-spam-score", "authentication-results", "received-spf"];
const BODY_LIMIT = 64 * 1024;

/** Abre el buzón en solo lectura, ejecuta `work` y cierra la conexión. */
async function withMailbox<T>(work: (client: ImapFlow, uidValidity: string, mailbox: string, exists: number) => Promise<T>) {
  const config = inboxConfig();
  if (!config.configured) throw new Error("Buzón no configurado (IMAP_*).");
  const client = new ImapFlow({
    host: config.host!, port: config.port, secure: config.port === 993, auth: { user: config.user!, pass: config.pass! },
    logger: false, connectionTimeout: 10_000, greetingTimeout: 8_000, socketTimeout: 30_000, disableAutoIdle: true,
  });
  client.on("error", (error) => console.error("inbox_imap_error", error));
  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox, { readOnly: true });
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error(`No se pudo abrir la carpeta ${config.mailbox}.`);
      return await work(client, String(mailbox.uidValidity), config.mailbox, mailbox.exists);
    } finally { lock.release(); }
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Datos, cuerpo, enlaces y adjuntos de los mensajes de `range` con UID mayor que `afterUid`, del más antiguo al más nuevo. */
async function fetchMessages(client: ImapFlow, range: string, uidValidity: string, mailbox: string, afterUid: number | null, limit: number) {
  // Primero los datos de cada mensaje y después los cuerpos: imapflow no admite otros comandos dentro de fetch().
  const listed = [];
  for await (const message of client.fetch(range, { uid: true, envelope: true, bodyStructure: true, internalDate: true, headers: CLASSIFY_HEADERS }, { uid: true })) {
    // "N:*" devuelve el último mensaje aunque su UID sea menor que N (regla de IMAP): se descarta.
    if (afterUid !== null && message.uid <= afterUid) continue;
    listed.push(message);
  }
  listed.sort((a, b) => a.uid - b.uid);

  const messages: InboundMessage[] = [];
  for (const message of listed.slice(0, limit)) {
    const envelope = message.envelope ?? {};
    const parts: Parts = message.bodyStructure ? findParts(message.bodyStructure) : { plain: null, html: null, attachments: [] };
    const download = (part: TextPart) => downloadText(client, message.uid, part).catch((error) => { console.error("inbox_body_failed", message.uid, error); return ""; });
    const html = parts.html ? await download(parts.html) : "";
    const text = parts.plain ? await download(parts.plain) : html ? htmlToText(html) : "";
    const date = envelope.date ?? message.internalDate;
    messages.push({
      uid: message.uid,
      messageId: envelope.messageId?.trim() || `<uid-${uidValidity}-${message.uid}@${mailbox}>`,
      date: date ? new Date(date) : null,
      subject: (envelope.subject ?? "").trim(),
      from: address(envelope.from?.[0]), replyTo: address(envelope.replyTo?.[0]),
      headers: parseHeaders(message.headers),
      text, links: html ? extractLinks(html) : extractUrls(text), attachments: parts.attachments,
    });
  }
  return { messages, more: listed.length > limit };
}

/**
 * Trae los correos posteriores al `cursor` (último UID revisado) o, si no hay cursor, los recibidos desde `since`,
 * del más antiguo al más nuevo y como máximo `limit`; `more` indica que quedaron otros para la siguiente revisión.
 * Si el servidor reconstruyó el buzón cambia UIDVALIDITY: los UID anteriores ya no sirven y se busca por fecha.
 */
export async function readInbox(options: { cursor: { uidValidity: string; uid: number } | null; since: Date; limit: number }) {
  return withMailbox(async (client, uidValidity, mailbox, exists) => {
    const afterUid = options.cursor?.uidValidity === uidValidity ? options.cursor.uid : null;
    const range = !exists ? null : afterUid !== null ? `${afterUid + 1}:*` : await uidsSince(client, options.since);
    if (!range) return { uidValidity, mailbox, messages: [] as InboundMessage[], more: false };
    return { uidValidity, mailbox, ...await fetchMessages(client, range, uidValidity, mailbox, afterUid, options.limit) };
  });
}

/** Vuelve a leer un correo ya revisado (para liberarlo de la cuarentena). `null` si ya no está en el buzón o el buzón cambió. */
export async function readMessage(target: { uidValidity: string; uid: number }) {
  return withMailbox(async (client, uidValidity, mailbox) => {
    if (uidValidity !== target.uidValidity) return null;
    const { messages } = await fetchMessages(client, String(target.uid), uidValidity, mailbox, target.uid - 1, 1);
    return messages[0]?.uid === target.uid ? { uidValidity, mailbox, message: messages[0] } : null;
  });
}

/** Rango de UID de los mensajes recibidos desde `since` (SEARCH SINCE trabaja por días). */
async function uidsSince(client: ImapFlow, since: Date) {
  const uids = await client.search({ since }, { uid: true });
  return uids && uids.length ? uids.join(",") : null;
}

const address = (value?: { name?: string; address?: string }): InboxAddress | null => value?.address ? { name: (value.name ?? "").replace(/^["']+|["']+$/g, "").trim(), address: value.address.trim().toLowerCase() } : null;

function parseHeaders(raw?: Buffer) {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const line of raw.toString("utf8").replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const index = line.indexOf(":");
    // Se queda la primera aparición: la de más arriba la añadió nuestro servidor (las de abajo pudo escribirlas el remitente).
    const key = index > 0 ? line.slice(0, index).trim().toLowerCase() : "";
    if (key && !(key in headers)) headers[key] = line.slice(index + 1).trim();
  }
  return headers;
}

type TextPart = { part: string; html: boolean };
type Parts = { plain: TextPart | null; html: TextPart | null; attachments: string[] };

/**
 * Partes del mensaje: el primer text/plain y el primer text/html que no sean adjuntos (no entra en correos reenviados
 * como adjunto) y los nombres de los adjuntos.
 */
function findParts(root: MessageStructureObject): Parts {
  const found: Parts = { plain: null, html: null, attachments: [] };
  const visit = (node: MessageStructureObject, inside: boolean) => {
    const type = node.type.toLowerCase();
    const filename = node.dispositionParameters?.filename ?? node.parameters?.name;
    const attached = node.disposition?.toLowerCase() === "attachment" || type === "message/rfc822" || Boolean(filename && !type.startsWith("multipart/") && !type.startsWith("text/"));
    if (attached && filename && found.attachments.length < 30) found.attachments.push(filename.slice(0, 200));
    if (node.childNodes?.length) { for (const child of node.childNodes) visit(child, inside || attached); return; }
    if (inside || attached) return;
    const part = node.part ?? "1";
    if (type === "text/plain" && !found.plain) found.plain = { part, html: false };
    if (type === "text/html" && !found.html) found.html = { part, html: true };
  };
  visit(root, false);
  return found;
}

/** Contenido de una parte de texto (el HTML se devuelve tal cual). */
async function downloadText(client: ImapFlow, uid: number, target: TextPart) {
  const { content } = await client.download(String(uid), target.part, { uid: true, maxBytes: BODY_LIMIT });
  if (!content) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of content) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const fromCodePoint = (code: number) => Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
const entities: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", iexcl: "¡", iquest: "¿" };

/** HTML de correo a texto: suficiente para leer la solicitud en el CRM (no conserva formato). */
export function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, code: string) => code[0] === "#" ? fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : entities[code] ?? match)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
