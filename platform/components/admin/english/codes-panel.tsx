"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send, useDebounced, useJson } from "@/components/admin/kit";
import { formatCode, GRADES } from "@/lib/english/levels";
import type { AdminCode } from "@/lib/english/resources";

type CodeRow = Omit<AdminCode, "expiresAt" | "lastUsedAt" | "createdAt"> & { expiresAt: string | null; lastUsedAt: string | null; createdAt: string; expired: boolean };

// Descarga del CSV (ruta de API, no una página: un enlace normal basta).
const exportUrl = (lote?: string) => `/api/admin/ingles/codigos/export${lote ? `?lote=${encodeURIComponent(lote)}` : ""}`;

const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const showDate = (value: string | null) => value ? dateFormat.format(new Date(value)) : "—";
const showGrades = (value: string) => value === "all" ? "1° a 5°" : value.split(",").map((grade) => `${grade}°`).join(", ");

async function copy(text: string, message: string) {
  try { await navigator.clipboard.writeText(text); toast.success(message); }
  catch { toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano."); }
}

/** Códigos de acceso: lotes por colegio/curso, con usos, vencimiento y estado. */
export function CodesPanel({ onChanged }: { onChanged: () => void }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = useJson<{ codes: CodeRow[] }>("/api/admin/ingles/codigos", revision);
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim().toLowerCase());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ label: string; codes: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const codes = useMemo(() => (data?.codes ?? []).filter((code) => !search || code.label.toLowerCase().includes(search) || code.code.toLowerCase().includes(search.replace(/[^a-z0-9]/g, ""))), [data, search]);
  const reload = () => { setRevision((value) => value + 1); onChanged(); };

  async function toggle(code: CodeRow) {
    if (code.active && !confirm(`¿Desactivar ${formatCode(code.code)}? Quienes lo usaron pierden el acceso de inmediato.`)) return;
    setBusy(code.id);
    const result = await send(`/api/admin/ingles/codigos/${code.id}`, "PATCH", { active: !code.active }, code.active ? "Código desactivado." : "Código activado.");
    setBusy(null);
    if (result) reload();
  }

  return <section className="panel adm-section adm-eng">
    <div className="adm-toolbar">
      <label className="adm-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por lote o código" aria-label="Buscar códigos" /></label>
      <div className="adm-toolbar-end">
        <a className="refresh-button" href={exportUrl()} download><Download size={14} /> Exportar CSV</a>
        <button type="button" className="button button-dark" onClick={() => setCreating(true)}><Plus size={16} /> Crear códigos</button>
      </div>
    </div>

    {created && <div className="adm-callout is-ok adm-eng-created">
      <div><strong>{created.codes.length === 1 ? "Código creado" : `${created.codes.length} códigos creados`}</strong> · {created.label}</div>
      <code>{created.codes.slice(0, 12).map(formatCode).join("  ")}{created.codes.length > 12 ? "  …" : ""}</code>
      <div className="adm-actions-row">
        <button type="button" className="refresh-button" onClick={() => void copy(created.codes.map(formatCode).join("\n"), "Códigos copiados.")}><Copy size={13} /> Copiar {created.codes.length === 1 ? "código" : "todos"}</button>
        <a className="refresh-button" href={exportUrl(created.label)} download><Download size={13} /> CSV de este lote</a>
        <button type="button" className="refresh-button" onClick={() => setCreated(null)}>Cerrar</button>
      </div>
    </div>}

    {error && !data ? <p className="checkout-status">{error}</p> : !data ? <p className="adm-muted">Cargando…</p> : !data.codes.length ? <div className="adm-empty">
      <strong>Todavía no hay códigos.</strong>
      <span>Crea un lote por colegio o curso (por ejemplo, 40 códigos de 3°A con vigencia del año escolar) o un código con nombre propio para imprimir en todos los libros de un grado.</span>
      <button type="button" className="button button-dark" onClick={() => setCreating(true)}><Plus size={16} /> Crear el primer lote</button>
    </div> : <div className="sales-table-scroll"><table className="admin-table adm-table adm-eng-codes">
      <thead><tr><th>Código</th><th>Lote</th><th>Grados</th><th>Usos</th><th>Vence</th><th>Último uso</th><th>Estado</th></tr></thead>
      <tbody>{codes.map((code) => {
        const expired = code.expired;
        const full = code.maxUses !== null && code.uses >= code.maxUses;
        return <tr key={code.id} className={code.active ? undefined : "is-muted"}>
          <td><button type="button" className="adm-eng-code" onClick={() => void copy(formatCode(code.code), "Código copiado.")} title="Copiar">{formatCode(code.code)} <Copy size={12} aria-hidden="true" /></button></td>
          <td>{code.label}</td>
          <td>{showGrades(code.grades)}</td>
          <td><span className={full ? "adm-eng-warn" : undefined}>{code.uses} / {code.maxUses ?? "∞"}</span></td>
          <td><span className={expired ? "adm-eng-warn" : undefined}>{showDate(code.expiresAt)}</span></td>
          <td>{showDate(code.lastUsedAt)}</td>
          <td><button type="button" className={code.active ? "adm-eng-switch is-on" : "adm-eng-switch"} role="switch" aria-checked={code.active} disabled={busy === code.id} onClick={() => void toggle(code)}>{code.active ? (expired ? "Vencido" : full ? "Agotado" : "Activo") : "Inactivo"}</button></td>
        </tr>;
      })}</tbody>
    </table>{!codes.length && <p className="adm-muted">Ningún código coincide con “{query}”.</p>}{data.codes.length >= 500 && <p className="adm-muted">Se muestran los 500 más recientes; el CSV trae todos.</p>}</div>}

    {creating && <CreateCodesDrawer onClose={() => setCreating(false)} onCreated={(label, list) => { setCreating(false); setCreated({ label, codes: list }); reload(); }} />}
  </section>;
}

function CreateCodesDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (label: string, codes: string[]) => void }) {
  const [mode, setMode] = useState<"batch" | "custom">("batch");
  const [grades, setGrades] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const all = grades.length === GRADES.length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grades.length) { toast.error("Elige al menos un grado."); return; }
    const form = new FormData(event.currentTarget);
    const maxUses = String(form.get("maxUses") ?? "").trim();
    const body = {
      label: String(form.get("label") ?? ""), grades, count: mode === "batch" ? Number(form.get("count") || 1) : 1,
      maxUses: maxUses ? Number(maxUses) : null, expiresAt: String(form.get("expiresAt") ?? "") || null,
      customCode: mode === "custom" ? String(form.get("customCode") ?? "") : undefined,
    };
    setSaving(true);
    const result = await send<{ codes: { code: string }[] }>("/api/admin/ingles/codigos", "POST", body);
    setSaving(false);
    if (result) onCreated(body.label.trim(), result.codes.map((item) => item.code));
  }

  return <Drawer open title="Crear códigos" subtitle="Cada código desbloquea los grados que elijas" onClose={onClose}>
    <form className="adm-form adm-eng-form" onSubmit={submit}>
      <div className="adm-segmented" role="group" aria-label="Tipo de código">
        <button type="button" aria-pressed={mode === "batch"} onClick={() => setMode("batch")}>Lote de códigos aleatorios</button>
        <button type="button" aria-pressed={mode === "custom"} onClick={() => setMode("custom")}>Un código con nombre propio</button>
      </div>
      <label>Nombre del lote<input name="label" required minLength={2} maxLength={120} placeholder="Colegio San José · 3°A · 2027" /><small>Para encontrarlos después y saber a quién se entregaron.</small></label>
      <fieldset className="adm-eng-grade-picker"><legend>Grados que desbloquea</legend>
        {GRADES.map((grade) => <button key={grade} type="button" aria-pressed={grades.includes(grade)} onClick={() => setGrades((current) => current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade].sort())}>{grade}°</button>)}
        <button type="button" aria-pressed={all} onClick={() => setGrades(all ? [] : [...GRADES])}>Todos</button>
      </fieldset>
      {mode === "batch"
        ? <label>Cantidad de códigos<input name="count" type="number" min={1} max={500} defaultValue={30} required /><small>Uno por estudiante, hasta 500 por lote.</small></label>
        : <label>Código<input name="customCode" required minLength={6} maxLength={29} placeholder="TERCERO2027" className="adm-eng-mono" onChange={(event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); }} /><small>Letras y números (6 a 24). Ideal para imprimir el mismo código en todos los libros de un grado.</small></label>}
      <div className="adm-form-grid" key={mode}>
        <label>Usos por código<input name="maxUses" type="number" min={1} max={100000} defaultValue={mode === "batch" ? 3 : ""} placeholder="Ilimitado" /><small>{mode === "batch" ? "3 = celular, tablet y computador del estudiante." : "Vacío = sin límite."}</small></label>
        <label>Vence<input name="expiresAt" type="date" min={new Date().toISOString().slice(0, 10)} /><small>Opcional. Al final de ese día.</small></label>
      </div>
      <div className="adm-actions-row"><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Creando…" : mode === "batch" ? "Crear lote" : "Crear código"}</button><button className="refresh-button" type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  </Drawer>;
}
