import "server-only";
import nodemailer from "nodemailer";

/**
 * Correo transaccional por SMTP (en cPanel: una cuenta de correo del dominio). Sin credenciales no se
 * envía nada; en desarrollo se imprime el mensaje en la consola para poder revisarlo.
 *
 * Variables: SMTP_HOST, SMTP_PORT (465 SSL o 587 STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM ("Alesya <correo@dominio>").
 */
export function mailStatus() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM);
  return { configured, host: SMTP_HOST ?? null, port: Number(SMTP_PORT) || 465, from: MAIL_FROM ?? null, devPreview: !configured && process.env.NODE_ENV !== "production" };
}

export type MailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type MailResult = { sent: boolean; reason?: string };

const SEND_TIMEOUT_MS = 12_000;

function transport() {
  const status = mailStatus();
  if (status.configured) {
    return nodemailer.createTransport({ host: status.host!, port: status.port, secure: status.port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 8_000, greetingTimeout: 8_000 });
  }
  if (status.devPreview) return nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true });
  return null;
}

/** Envía un correo. Nunca lanza: devuelve `sent: false` con el motivo para registrarlo en la trazabilidad. */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transporter = transport();
  if (!transporter) return { sent: false, reason: "Correo no configurado (SMTP_*)." };
  try {
    const info = await Promise.race([
      transporter.sendMail({ from: process.env.MAIL_FROM ?? "Alesya <no-reply@localhost>", to: message.to, subject: message.subject, html: message.html, text: message.text, replyTo: message.replyTo }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), SEND_TIMEOUT_MS)),
    ]);
    if (mailStatus().devPreview) console.log(`[mail preview] → ${message.to} · ${message.subject}\n${message.text}\n`);
    return { sent: true, reason: typeof info === "object" && info && "messageId" in info ? String((info as { messageId?: string }).messageId ?? "") : undefined };
  } catch (error) {
    console.error("mail_send_failed", message.subject, error);
    return { sent: false, reason: error instanceof Error ? error.message : "Error al enviar." };
  }
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Plantilla HTML sencilla y compatible con clientes de correo. `paragraphs` acepta texto plano (se escapa) con saltos de línea. */
export function renderEmail(input: { title: string; intro: string; rows?: [string, string][]; paragraphs?: string[]; cta?: { label: string; url: string }; footer?: string }) {
  const rows = input.rows?.length ? `<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">${input.rows.map(([label, value]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e8e3;color:#697282">${escape(label)}</td><td style="padding:8px 0;border-bottom:1px solid #e6e8e3;text-align:right;font-weight:700">${escape(value)}</td></tr>`).join("")}</table>` : "";
  const paragraphs = (input.paragraphs ?? []).map((text) => `<p style="margin:0 0 14px;line-height:1.6;white-space:pre-line">${escape(text)}</p>`).join("");
  const cta = input.cta ? `<p style="margin:22px 0"><a href="${escape(input.cta.url)}" style="display:inline-block;background:#d7ff43;color:#101828;text-decoration:none;font-weight:800;padding:13px 22px;letter-spacing:.06em;text-transform:uppercase;font-size:12px">${escape(input.cta.label)}</a></p>` : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f5f6f2;font-family:Avenir Next,Segoe UI,Helvetica,Arial,sans-serif;color:#101828"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#697282;margin:0 0 10px">Alesya Ediciones · Alesya X-Tech</p><div style="background:#fff;border:1px solid #e1e4df;padding:26px"><h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.02em">${escape(input.title)}</h1><p style="margin:0 0 14px;line-height:1.6">${escape(input.intro)}</p>${rows}${paragraphs}${cta}</div><p style="font-size:12px;color:#697282;margin:16px 0 0;line-height:1.5">${escape(input.footer ?? "Alesya Ediciones · Funza, Colombia · comercial@alesyaediciones.com · +57 300 593 7840")}</p></div></body></html>`;
  const text = [input.title, "", input.intro, "", ...(input.rows ?? []).map(([label, value]) => `${label}: ${value}`), "", ...(input.paragraphs ?? []), input.cta ? `${input.cta.label}: ${input.cta.url}` : "", "", input.footer ?? "Alesya Ediciones · comercial@alesyaediciones.com · +57 300 593 7840"].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { html, text };
}
