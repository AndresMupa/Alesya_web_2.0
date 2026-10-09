import "server-only";
import { ImapFlow, type MessageStructureObject } from "imapflow";

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
  /** Solo las cabeceras que sirven para reconocer envíos automáticos y spam, en minúsculas. */
  headers: Record<string, string>;
  /** Cuerpo en texto plano (de la parte text/plain o, si no hay, del HTML), hasta ~64 KB. */
  text: string;
};

const CLASSIFY_HEADERS = ["auto-submitted", "precedence", "list-id", "list-unsubscribe", "x-autoreply", "x-autorespond", "x-spam-flag"];
const BODY_LIMIT = 64 * 1024;

/**
 * Trae los correos posteriores al `cursor` (último UID revisado) o, si no hay cursor, los recibidos desde `since`,
 * del más antiguo al más nuevo y como máximo `limit`; `more` indica que quedaron otros para la siguiente revisión.
 * Si el servidor reconstruyó el buzón cambia UIDVALIDITY: los UID anteriores ya no sirven y se busca por fecha.
 */
export async function readInbox(options: { cursor: { uidValidity: string; uid: number } | null; since: Date; limit: number }) {
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
      const uidValidity = String(mailbox.uidValidity);
      const afterUid = options.cursor?.uidValidity === uidValidity ? options.cursor.uid : null;
      const range = !mailbox.exists ? null : afterUid !== null ? `${afterUid + 1}:*` : await uidsSince(client, options.since);
      if (!range) return { uidValidity, mailbox: config.mailbox, messages: [] as InboundMessage[], more: false };

      // Primero los datos de cada mensaje y después los cuerpos: imapflow no admite otros comandos dentro de fetch().
      const listed = [];
      for await (const message of client.fetch(range, { uid: true, envelope: true, bodyStructure: true, internalDate: true, headers: CLASSIFY_HEADERS }, { uid: true })) {
        // "N:*" devuelve el último mensaje aunque su UID sea menor que N (regla de IMAP): se descarta.
        if (afterUid !== null && message.uid <= afterUid) continue;
        listed.push(message);
      }
      listed.sort((a, b) => a.uid - b.uid);

      const messages: InboundMessage[] = [];
      for (const message of listed.slice(0, options.limit)) {
        const envelope = message.envelope ?? {};
        const textPart = message.bodyStructure ? findTextPart(message.bodyStructure) : null;
        const date = envelope.date ?? message.internalDate;
        messages.push({
          uid: message.uid,
          messageId: envelope.messageId?.trim() || `<uid-${uidValidity}-${message.uid}@${config.mailbox}>`,
          date: date ? new Date(date) : null,
          subject: (envelope.subject ?? "").trim(),
          from: address(envelope.from?.[0]), replyTo: address(envelope.replyTo?.[0]),
          headers: parseHeaders(message.headers),
          text: textPart ? await downloadText(client, message.uid, textPart).catch((error) => { console.error("inbox_body_failed", message.uid, error); return ""; }) : "",
        });
      }
      return { uidValidity, mailbox: config.mailbox, messages, more: listed.length > options.limit };
    } finally { lock.release(); }
  } finally {
    await client.logout().catch(() => client.close());
  }
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
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

type TextPart = { part: string; html: boolean };

/** La parte de texto del mensaje: text/plain si existe, si no text/html. No entra en adjuntos ni en correos reenviados como adjunto. */
function findTextPart(root: MessageStructureObject): TextPart | null {
  if (!root.childNodes?.length) return /^text\/(plain|html)$/i.test(root.type) ? { part: "1", html: /html/i.test(root.type) } : null;
  let html: TextPart | null = null;
  const visit = (node: MessageStructureObject): TextPart | null => {
    if (node.disposition?.toLowerCase() === "attachment" || node.type.toLowerCase() === "message/rfc822") return null;
    if (node.childNodes?.length) {
      for (const child of node.childNodes) { const found = visit(child); if (found) return found; }
      return null;
    }
    const type = node.type.toLowerCase();
    if (type === "text/plain" && node.part) return { part: node.part, html: false };
    if (type === "text/html" && node.part && !html) html = { part: node.part, html: true };
    return null;
  };
  return visit(root) ?? html;
}

async function downloadText(client: ImapFlow, uid: number, target: TextPart) {
  const { content } = await client.download(String(uid), target.part, { uid: true, maxBytes: BODY_LIMIT });
  if (!content) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of content) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return target.html ? htmlToText(text) : text;
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
