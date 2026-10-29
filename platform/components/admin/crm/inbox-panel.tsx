"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Metric, send, useJson } from "@/components/admin/kit";
import { formatDateTime, plural } from "@/lib/format";

type SyncResult = { at: string; ok: boolean; error?: string; created: number; matched: number; skipped: number; quarantined?: number; more: boolean };
type Signal = { code: string; label: string; points: number };
type Item = { id: string; fromEmail: string | null; fromName: string | null; subject: string; receivedAt: string | null; result: "created" | "matched" | "skipped" | "quarantined"; reason: string | null; leadId: string | null; organization: string | null; riskScore: number | null; riskLevel: "ok" | "suspicious" | "dangerous" | null; riskSignals: Signal[] };
type Overview = {
  inbox: { configured: boolean; user: string | null; host: string | null; port: number; mailbox: string };
  lastSync: SyncResult | null;
  recent: Item[];
  quarantine: Item[];
  last30Days: { created: number; matched: number; skipped: number; quarantined: number };
};

const resultLabel = { created: "Lead nuevo", matched: "Al historial", skipped: "Omitido", quarantined: "Cuarentena" } as const;
const levelLabel = { dangerous: "Peligroso", suspicious: "Sospechoso", ok: "Sin riesgo" } as const;

export function syncSummary(result: Pick<SyncResult, "created" | "matched" | "quarantined">) {
  return [result.created && plural(result.created, "lead nuevo", "leads nuevos"), result.matched && plural(result.matched, "respuesta sumada", "respuestas sumadas"), result.quarantined && plural(result.quarantined, "correo en cuarentena", "correos en cuarentena")].filter(Boolean).join(" y ");
}

/** Un correo retenido por el guardián: por qué y cómo pasarlo al CRM si es legítimo. */
function QuarantineItem({ item, onReleased }: { item: Item; onReleased: (leadId: string | null) => void }) {
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  async function release() {
    const warning = item.riskLevel === "dangerous" ? "El guardián lo marcó como PELIGROSO. ¿Confirmaste con el remitente (por teléfono, no respondiendo el correo) que es legítimo?" : "¿Pasar este correo al CRM?";
    if (!window.confirm(warning)) return;
    setBusy(true);
    const result = await send<{ result: Item["result"]; reason: string | null; leadId: string | null }>(`/api/admin/crm/inbox/${item.id}`, "POST", { trustSender: trust });
    setBusy(false);
    if (!result) return;
    toast.success(result.result === "skipped" ? `Liberado, pero la captación lo omitió: ${result.reason}.` : `Liberado: ${resultLabel[result.result].toLowerCase()}.`);
    onReleased(result.leadId);
  }
  return <li data-result="quarantined" data-level={item.riskLevel ?? undefined}>
    <div>
      <strong>{item.subject || "(sin asunto)"}</strong>
      <span>{item.fromName ? `${item.fromName} · ` : ""}{item.fromEmail ?? "Sin remitente"}{item.receivedAt ? ` · ${formatDateTime(item.receivedAt)}` : ""}</span>
      <span><b className="status-pill" data-result="quarantined" data-level={item.riskLevel ?? undefined}>{levelLabel[item.riskLevel ?? "suspicious"]} · {item.riskScore ?? 0}/100</b></span>
      {item.riskSignals.length > 0 && <ul className="adm-guard-signals">{item.riskSignals.map((signal) => <li key={signal.code}>{signal.label} <small>(+{signal.points})</small></li>)}</ul>}
    </div>
    <div className="adm-guard-actions">
      <button type="button" className="refresh-button" onClick={() => void release()} disabled={busy}>{busy ? "Liberando…" : "Es legítimo: pasar al CRM"}</button>
      <label><input type="checkbox" checked={trust} onChange={(event) => setTrust(event.target.checked)} /> Confiar en este remitente</label>
    </div>
  </li>;
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 24 * 60) return `hace ${Math.round(minutes / 60)} h`;
  return formatDateTime(iso);
}

/** Captación por correo: el buzón comercial que alimenta el CRM, su última revisión y qué pasó con cada correo. */
export function InboxPanel({ onOpenLead, onSynced }: { onOpenLead: (id: string) => void; onSynced: () => void }) {
  const [revision, setRevision] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { data, error } = useJson<Overview>("/api/admin/crm/inbox", revision);

  async function syncNow() {
    setSyncing(true);
    const result = await send<SyncResult>("/api/admin/crm/inbox", "POST", {});
    setSyncing(false);
    setRevision((value) => value + 1);
    if (!result) return;
    const summary = syncSummary(result);
    toast.success(summary ? `Correo revisado: ${summary}.` : "Correo revisado: no hay correos nuevos de clientes.");
    if (summary) onSynced();
  }

  const last = data?.lastSync;
  return <section className="panel adm-section">
    <div className="panel-header">
      <div><h2><Inbox size={17} /> Captación por correo</h2><p className="adm-muted">Cada correo que llega al buzón comercial entra solo al CRM: si quien escribe ya es un contacto, queda en su historial con seguimiento para hoy; si no, se crea un lead nuevo con prioridad alta.</p></div>
      {data?.inbox.configured && <button type="button" className="refresh-button" onClick={() => void syncNow()} disabled={syncing}><RefreshCw size={14} /> {syncing ? "Revisando…" : "Revisar ahora"}</button>}
    </div>
    {error && <p className="adm-callout">{error}</p>}
    {!data && !error && <p className="adm-muted">Cargando…</p>}
    {data && !data.inbox.configured && <p className="adm-callout">
      Falta conectar el buzón. En el servidor (cPanel → “Setup Node.js App”, o el <code>.htaccess</code> de la app) define <code>IMAP_USER</code> con el correo que recibe a los clientes (por ejemplo <code>comercial@alesyaediciones.com</code>) e <code>IMAP_PASS</code> con su contraseña; si es la misma cuenta del correo de envío (<code>SMTP_USER</code>) basta con <code>IMAP_USER</code>. Después reinicia la app y programa el cron cada 10 minutos (ver documentación de despliegue).
    </p>}
    {data?.inbox.configured && <>
      <p className={`adm-callout${last?.ok ? " is-ok" : ""}`}>
        Conectado a <strong>{data.inbox.user}</strong> ({data.inbox.mailbox} en {data.inbox.host}:{data.inbox.port}), solo lectura: no marca ni mueve correos.{" "}
        {!last ? "Aún no se ha revisado: la primera revisión trae los correos de los últimos 3 días." : last.ok ? <>Última revisión {ago(last.at)}{syncSummary(last) ? `: ${syncSummary(last)}` : ": sin correos nuevos de clientes"}.{last.more ? " Quedan más correos; se siguen trayendo en las próximas revisiones." : ""}</> : <>La última revisión ({ago(last.at)}) falló: <strong>{last.error}</strong></>}
      </p>
      <div className="adm-metrics adm-metrics-4 adm-section">
        <Metric label="Leads nuevos por correo" value={data.last30Days.created} hint="Últimos 30 días" tone={data.last30Days.created ? "good" : undefined} />
        <Metric label="Respuestas al historial" value={data.last30Days.matched} hint="De contactos que ya estaban en el CRM" />
        <Metric label="En cuarentena" value={data.last30Days.quarantined} hint="Retenidos por el guardián del correo" />
        <Metric label="Omitidos" value={data.last30Days.skipped} hint="Equipo, automáticos, boletines, spam e ignorados" />
      </div>
      <div className="panel-header adm-section"><div><h2><ShieldAlert size={17} /> Cuarentena del guardián</h2><p className="adm-muted">Correos con señales de phishing, suplantación, fraude de pagos, adjuntos peligrosos o premios pagados. No entran al CRM; los peligrosos además se avisan al correo del equipo. Siguen en el buzón: no abras sus enlaces ni adjuntos.</p></div></div>
      {data.quarantine.length ? <ul className="adm-queue adm-inbox-list">{data.quarantine.map((item) => <QuarantineItem key={item.id} item={item} onReleased={(leadId) => { setRevision((value) => value + 1); onSynced(); if (leadId) onOpenLead(leadId); }} />)}</ul>
        : <div className="adm-empty"><strong>Sin correos en cuarentena</strong><span>En los últimos 30 días el guardián no retuvo nada.</span></div>}
      <div className="panel-header adm-section"><h2>Últimos correos revisados</h2></div>
      {data.recent.length ? <ul className="adm-queue adm-inbox-list">{data.recent.map((item) => <li key={item.id} data-result={item.result} data-level={item.result === "quarantined" ? item.riskLevel ?? undefined : undefined}>
        <div>
          <strong>{item.subject || "(sin asunto)"}</strong>
          <span>{item.fromName ? `${item.fromName} · ` : ""}{item.fromEmail ?? "Sin remitente"}{item.receivedAt ? ` · ${formatDateTime(item.receivedAt)}` : ""}</span>
          <span><b className="status-pill" data-result={item.result} data-level={item.result === "quarantined" ? item.riskLevel ?? undefined : undefined}>{item.result === "quarantined" ? levelLabel[item.riskLevel ?? "suspicious"] : resultLabel[item.result]}</b> {item.result === "skipped" ? item.reason : item.result === "quarantined" ? item.riskSignals[0]?.label : item.organization}{item.result !== "quarantined" && item.riskLevel && item.riskLevel !== "ok" ? ` · ⚠ ${levelLabel[item.riskLevel]} (${item.riskScore}/100)` : ""}</span>
        </div>
        {item.leadId && <button type="button" className="refresh-button" onClick={() => onOpenLead(item.leadId!)}>Ficha</button>}
      </li>)}</ul> : <div className="adm-empty"><strong>Todavía no hay correos revisados</strong><span>Aparecerán aquí después de la primera revisión.</span></div>}
      <p className="adm-hint">Se omiten los correos del propio equipo, las respuestas automáticas, los boletines, el spam y los remitentes de la lista de ignorados (proveedores, bancos…), que se edita en <Link href="/admin/configuracion">Configuración</Link> junto con los remitentes de confianza del guardián. La revisión corre sola con el cron <code>/api/cron/inbox?token=…</code> cada 10 minutos y también al abrir la máquina de ventas.</p>
    </>}
  </section>;
}
