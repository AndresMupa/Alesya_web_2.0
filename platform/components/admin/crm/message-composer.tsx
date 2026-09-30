"use client";

import { useState } from "react";
import { Copy, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { fillTemplate, templatesFor, type MessageTemplate } from "@/lib/crm/templates";
import { whatsappLink } from "@/lib/format";

export type ComposerLead = { name: string; organization: string; city: string | null; phone: string | null; email: string | null; stage: string };
type Channel = MessageTemplate["channel"];

export const phonesOf = (phone: string | null | undefined) => (phone ?? "").split(/[;,/]/).map((value) => value.trim()).filter((value) => value.replace(/\D/g, "").length >= 7);
/** Solo los celulares sirven para WhatsApp (10 dígitos que empiezan por 3); los fijos quedan para llamar. */
export const mobilesOf = (phone: string | null | undefined) => phonesOf(phone).filter((value) => /^3\d{9}$/.test(value.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "")));

/**
 * Redacta un WhatsApp o correo desde una plantilla (editable) y lo abre en la app correspondiente.
 * No envía nada por sí mismo: el asesor lo revisa y lo manda; después registra el resultado.
 */
export function MessageComposer({ lead, asesor, onOpened, compact }: { lead: ComposerLead; asesor: string; onOpened?: (channel: Channel, template: string) => void; compact?: boolean }) {
  const phones = mobilesOf(lead.phone);
  const [channel, setChannel] = useState<Channel>(phones.length || !lead.email ? "whatsapp" : "email");
  const templates = templatesFor(channel, lead.stage);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [phone, setPhone] = useState(phones[0] ?? "");
  const [text, setText] = useState(() => (templates[0] ? fillTemplate(templates[0].body, lead, asesor) : ""));
  const template = templates.find((item) => item.id === templateId) ?? templates[0];

  function pickChannel(next: Channel) {
    setChannel(next);
    const first = templatesFor(next, lead.stage)[0];
    setTemplateId(first?.id ?? "");
    setText(first ? fillTemplate(first.body, lead, asesor) : "");
  }
  function pickTemplate(id: string) {
    setTemplateId(id);
    const next = templates.find((item) => item.id === id);
    if (next) setText(fillTemplate(next.body, lead, asesor));
  }

  const waUrl = channel === "whatsapp" ? whatsappLink(phone, text) : null;
  const mailUrl = channel === "email" && lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent(fillTemplate(template?.subject ?? "Alesya X-Tech", lead, asesor))}&body=${encodeURIComponent(text)}` : null;
  const href = channel === "whatsapp" ? waUrl : mailUrl;

  return <div className={`adm-composer${compact ? " is-compact" : ""}`}>
    <div className="adm-composer-head">
      <div className="adm-segmented" role="group" aria-label="Canal">
        <button type="button" aria-pressed={channel === "whatsapp"} onClick={() => pickChannel("whatsapp")} disabled={!phones.length}><MessageCircle size={14} /> WhatsApp</button>
        <button type="button" aria-pressed={channel === "email"} onClick={() => pickChannel("email")} disabled={!lead.email}><Mail size={14} /> Correo</button>
      </div>
      <select className="admin-inline-input" value={template?.id ?? ""} onChange={(event) => pickTemplate(event.target.value)} aria-label="Plantilla">
        {templates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {channel === "whatsapp" && phones.length > 1 && <select className="admin-inline-input" value={phone} onChange={(event) => setPhone(event.target.value)} aria-label="Número">{phones.map((value) => <option key={value} value={value}>{value}</option>)}</select>}
    </div>
    {channel === "email" && template?.subject && <p className="adm-composer-subject">Asunto: {fillTemplate(template.subject, lead, asesor)}</p>}
    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={compact ? 4 : 6} maxLength={2000} aria-label="Mensaje" />
    <div className="adm-composer-actions">
      {href ? <a className="button button-primary" href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpened?.(channel, template?.label ?? "")}><ExternalLink size={15} /> Abrir {channel === "whatsapp" ? "WhatsApp" : "correo"}</a>
        : <span className="adm-muted">{channel === "whatsapp" ? "Sin número de celular válido." : "Sin correo."}</span>}
      <button type="button" className="refresh-button" onClick={() => { void navigator.clipboard.writeText(text).then(() => toast.success("Mensaje copiado."), () => toast.error("No se pudo copiar.")); }}><Copy size={14} /> Copiar</button>
      {!asesor && <small className="adm-muted">Escribe tu nombre en “Asesor” para firmar el mensaje.</small>}
    </div>
  </div>;
}
