"use client";

import { useState } from "react";
import { BookOpen, KeyRound } from "lucide-react";
import { Metric, useJson } from "@/components/admin/kit";
import { CodesPanel } from "@/components/admin/english/codes-panel";
import { ResourcesPanel } from "@/components/admin/english/resources-panel";
import type { Grade } from "@/lib/english/levels";
import type { LevelSummary } from "@/lib/english/resources";
type Overview = { levels: LevelSummary[]; stats: { published: number; drafts: number; activeCodes: number; redemptions: number }; uploads: boolean; accessConfigured: boolean };

/** Módulo del Área de Inglés en el panel: material por grado y códigos de acceso. */
export function EnglishManager() {
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<"material" | "codes">("material");
  const [grade, setGrade] = useState<Grade>(1);
  const { data, error } = useJson<Overview>("/api/admin/ingles", revision);
  const refresh = () => setRevision((value) => value + 1);

  if (error && !data) return <p className="checkout-status">{error}</p>;
  if (!data) return <p className="adm-muted">Cargando…</p>;
  return <>
    <section className="admin-summary adm-metrics">
      <Metric label="Material publicado" value={data.stats.published} hint="Visible en /ingles" />
      <Metric label="Borradores" value={data.stats.drafts} hint="Aún no se muestran" tone={data.stats.drafts ? "warning" : undefined} />
      <Metric label="Códigos activos" value={data.stats.activeCodes} />
      <Metric label="Canjes" value={data.stats.redemptions} hint="Veces que se usó un código" tone="good" />
    </section>
    {!data.accessConfigured && <p className="adm-callout adm-section">Falta <code>ADMIN_SESSION_SECRET</code> en el servidor: sin él no se pueden canjear códigos.</p>}
    {!data.uploads && <p className="adm-callout adm-section">Este alojamiento no guarda archivos subidos: el material solo se puede cargar en el servidor de cPanel.</p>}
    <div className="admin-tabs adm-section" role="tablist" aria-label="Secciones del Área de Inglés">
      <button type="button" role="tab" aria-selected={tab === "material"} className={tab === "material" ? "is-active" : undefined} onClick={() => setTab("material")}><BookOpen size={14} /> Material por grado</button>
      <button type="button" role="tab" aria-selected={tab === "codes"} className={tab === "codes" ? "is-active" : undefined} onClick={() => setTab("codes")}><KeyRound size={14} /> Códigos de acceso <span>{data.stats.activeCodes}</span></button>
    </div>
    {tab === "material" ? <ResourcesPanel levels={data.levels} grade={grade} onGrade={setGrade} onChanged={refresh} uploads={data.uploads} /> : <CodesPanel onChanged={refresh} />}
  </>;
}
