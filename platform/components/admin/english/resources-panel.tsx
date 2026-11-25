"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, Pencil, Plus, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { send, useJson } from "@/components/admin/kit";
import { LevelTextDrawer, ResourceDrawer } from "@/components/admin/english/resource-drawer";
import { formatBytes, GRADES, resourceTypes, type Grade } from "@/lib/english/levels";
import type { AdminResource, LevelSummary } from "@/lib/english/resources";

/** Material de un grado: lista en el orden público, con publicar/ocultar, reordenar, editar y eliminar. */
export function ResourcesPanel({ levels, grade, onGrade, onChanged, uploads }: { levels: LevelSummary[]; grade: Grade; onGrade: (grade: Grade) => void; onChanged: () => void; uploads: boolean }) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useJson<{ resources: AdminResource[] }>(`/api/admin/ingles/recursos?grado=${grade}`, revision);
  const [editing, setEditing] = useState<AdminResource | "new" | null>(null);
  const [editingLevel, setEditingLevel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const level = levels.find((item) => item.grade === grade)!;
  const resources = data?.resources ?? [];
  const reload = () => { setRevision((value) => value + 1); onChanged(); };

  async function patch(resource: AdminResource, body: Record<string, string>, success?: string) {
    setBusy(resource.id);
    const result = await send(`/api/admin/ingles/recursos/${resource.id}`, "PATCH", body, success);
    setBusy(null);
    if (result) reload();
  }

  async function remove(resource: AdminResource) {
    if (!confirm(`¿Eliminar "${resource.title}"? Se borra también su archivo y no se puede deshacer.`)) return;
    setBusy(resource.id);
    const response = await fetch(`/api/admin/ingles/recursos/${resource.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!response?.ok) { toast.error("No se pudo eliminar el material."); return; }
    toast.success("Material eliminado.");
    reload();
  }

  return <section className="panel adm-section adm-eng">
    <div className="adm-toolbar">
      <div className="adm-eng-grades" role="tablist" aria-label="Grado">
        {GRADES.map((item) => { const info = levels.find((row) => row.grade === item)!; return <button key={item} type="button" role="tab" aria-selected={item === grade} className={item === grade ? "is-active" : undefined} data-tone={info.tone} onClick={() => onGrade(item)}><b>{info.ordinal}</b><small>{info.total} publicados</small></button>; })}
      </div>
      <div className="adm-toolbar-end">
        <button type="button" className="refresh-button" onClick={() => setEditingLevel(true)}><Type size={14} /> Texto del grado</button>
        <a className="refresh-button" href={`/ingles/grado-${grade}`} target="_blank" rel="noopener"><ExternalLink size={14} /> Ver {level.ordinal}</a>
        <button type="button" className="button button-dark" onClick={() => setEditing("new")}><Plus size={16} /> Nuevo material</button>
      </div>
    </div>

    <p className="adm-muted adm-eng-intro"><strong>{level.ordinal} · {level.tagline}.</strong> {level.description}</p>

    {error && !data ? <p className="checkout-status">{error}</p> : !data ? <p className="adm-muted">Cargando…</p> : !resources.length ? <div className="adm-empty">
      <strong>{level.ordinal} todavía no tiene material.</strong>
      <span>Sube el libro digital, los audios de cada unidad, videos o actividades. Puedes dejarlos en borrador hasta revisarlos.</span>
      <button type="button" className="button button-dark" onClick={() => setEditing("new")}><Plus size={16} /> Agregar el primero</button>
    </div> : <div className="adm-eng-list" aria-busy={loading}>
      {resources.map((resource, index) => {
        const meta = resourceTypes[resource.type], Icon = meta.icon;
        return <article key={resource.id} className={`adm-eng-row is-${resource.type}${resource.status === "draft" ? " is-draft" : ""}`}>
          <span className="adm-eng-icon" aria-hidden="true"><Icon size={18} /></span>
          <div className="adm-eng-main">
            <strong>{resource.title}</strong>
            <span>{[meta.label, resource.unit || "Sin unidad", resource.externalUrl ? "Enlace de video" : [resource.format, formatBytes(resource.size)].filter(Boolean).join(" · ")].join(" · ")}</span>
          </div>
          <div className="adm-eng-flags">
            {resource.free && <span className="status-pill">Muestra gratis</span>}
            <span className={resource.status === "published" ? "status-pill" : "status-pill pending"}>{resource.status === "published" ? "Publicado" : "Borrador"}</span>
          </div>
          <div className="adm-eng-actions">
            <button type="button" className="adm-icon-button" aria-label="Subir" title="Subir" disabled={!!busy || index === 0} onClick={() => void patch(resource, { move: "up" })}><ArrowUp size={15} /></button>
            <button type="button" className="adm-icon-button" aria-label="Bajar" title="Bajar" disabled={!!busy || index === resources.length - 1} onClick={() => void patch(resource, { move: "down" })}><ArrowDown size={15} /></button>
            {resource.hasFile && <a className="adm-icon-button" href={`/ingles/archivo/${resource.id}`} target="_blank" rel="noopener" aria-label="Abrir archivo" title="Abrir archivo"><ExternalLink size={15} /></a>}
            <button type="button" className="adm-icon-button" aria-label={resource.status === "published" ? "Ocultar" : "Publicar"} title={resource.status === "published" ? "Ocultar (pasar a borrador)" : "Publicar"} disabled={!!busy}
              onClick={() => void patch(resource, { status: resource.status === "published" ? "draft" : "published" }, resource.status === "published" ? "Material oculto." : "Material publicado.")}>{resource.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button type="button" className="adm-icon-button" aria-label="Editar" title="Editar" onClick={() => setEditing(resource)}><Pencil size={15} /></button>
            <button type="button" className="adm-icon-button adm-danger" aria-label="Eliminar" title="Eliminar" disabled={!!busy} onClick={() => void remove(resource)}><Trash2 size={15} /></button>
          </div>
        </article>;
      })}
    </div>}

    {editing && <ResourceDrawer key={editing === "new" ? `new-${grade}` : editing.id} grade={grade} resource={editing === "new" ? null : editing} units={[...new Set(resources.map((item) => item.unit).filter(Boolean))]} uploads={uploads} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    {editingLevel && <LevelTextDrawer level={level} onClose={() => setEditingLevel(false)} onSaved={() => { setEditingLevel(false); onChanged(); }} />}
  </section>;
}
