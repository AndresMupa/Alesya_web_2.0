"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Metric, send, useJson } from "@/components/admin/kit";
import { formatDateTime, plural } from "@/lib/format";

type SyncResult = { at: string; ok: boolean; error?: string; created: number; matched: number; skipped: number; more: boolean };
type Overview = {
  inbox: { configured: boolean; user: string | null; host: string | null; port: number; mailbox: string };
  lastSync: SyncResult | null;
  recent: { id: string; fromEmail: string | null; fromName: string | null; subject: string; receivedAt: string | null; result: "created" | "matched" | "skipped"; reason: string | null; leadId: string | null; organization: string | null }[];
  last30Days: { created: number; matched: number; skipped: number };
};

const resultLabel = { created: "Lead nuevo", matched: "Al historial", skipped: "Omitido" } as const;

export function syncSummary(result: Pick<SyncResult, "created" | "matched">) {
  return [result.created && plural(result.created, "lead nuevo", "leads nuevos"), result.matched && plural(result.matched, "respuesta sumada", "respuestas sumadas")].filter(Boolean).join(" y ");
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
      <div className="adm-metrics adm-metrics-3 adm-section">
        <Metric label="Leads nuevos por correo" value={data.last30Days.created} hint="Últimos 30 días" tone={data.last30Days.created ? "good" : undefined} />
        <Metric label="Respuestas al historial" value={data.last30Days.matched} hint="De contactos que ya estaban en el CRM" />
        <Metric label="Omitidos" value={data.last30Days.skipped} hint="Equipo, automáticos, boletines, spam e ignorados" />
      </div>
      <div className="panel-header adm-section"><h2>Últimos correos revisados</h2></div>
      {data.recent.length ? <ul className="adm-queue adm-inbox-list">{data.recent.map((item) => <li key={item.id} data-result={item.result}>
        <div>
          <strong>{item.subject || "(sin asunto)"}</strong>
          <span>{item.fromName ? `${item.fromName} · ` : ""}{item.fromEmail ?? "Sin remitente"}{item.receivedAt ? ` · ${formatDateTime(item.receivedAt)}` : ""}</span>
          <span><b className="status-pill" data-result={item.result}>{resultLabel[item.result]}</b> {item.result === "skipped" ? item.reason : item.organization}</span>
        </div>
        {item.leadId && <button type="button" className="refresh-button" onClick={() => onOpenLead(item.leadId!)}>Ficha</button>}
      </li>)}</ul> : <div className="adm-empty"><strong>Todavía no hay correos revisados</strong><span>Aparecerán aquí después de la primera revisión.</span></div>}
      <p className="adm-hint">Se omiten los correos del propio equipo, las respuestas automáticas, los boletines, el spam y los remitentes de la lista de ignorados (proveedores, bancos…), que se edita en <Link href="/admin/configuracion">Configuración</Link>. La revisión corre sola con el cron <code>/api/cron/inbox?token=…</code> cada 10 minutos y también al abrir la máquina de ventas.</p>
    </>}
  </section>;
}
