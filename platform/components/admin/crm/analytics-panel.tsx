"use client";

import { ColumnChart, HBarChart } from "@/components/admin/charts";
import { Metric, useJson } from "@/components/admin/kit";
import { formatMoneyCompact, plural } from "@/lib/format";
import { budgetLabel, sectorLabel } from "@/lib/crm/score";

type Analytics = {
  forecast: { valueInCents: number; weightedInCents: number; deals: number; byMonth: { month: string; deals: number; valueInCents: number; weightedInCents: number }[] };
  conversion: { step: string; from: number; to: number; rate: number | null }[];
  daysInStage: { stage: string; label: string; avgDays: number | null; samples: number }[];
  channels: { channel: string; label: string; contacts: number; attempts: number; answerRate: number | null }[];
  grades: { A: number; B: number; C: number };
  byCity: { city: string; total: number; worked: number; open: number; won: number; valueInCents: number }[];
  byProgram: { program: string; total: number; won: number; valueInCents: number }[];
  bySector: { sector: string; total: number; won: number; students: number }[];
  inboundByWeek: { week: string; total: number }[];
};
type Team = {
  owners: { owner: string; assigned: number; open: number; valueInCents: number; won30: number; wonValueInCents30: number; lost30: number; due: number; touchesWeek: number; touchesMonth: number }[];
  sources: { source: string; label: string; total: number; open: number; won: number; lost: number; winRate: number | null }[];
  lostReasons: { reason: string; total: number }[];
};

const monthName = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", month: "short", year: "2-digit" });
const monthLabel = (month: string) => month === "sin-fecha" ? "Sin fecha" : monthName.format(new Date(`${month}-01T05:00:00Z`));
const shortDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const weekLabel = (week: string) => shortDate.format(new Date(`${week}T05:00:00Z`));

/** Analítica comercial: pronóstico, conversión, tiempos, canales, puntajes y segmentos (ciudad, programa, sector). */
export function AnalyticsPanel({ revision }: { revision: number }) {
  const { data, error, loading } = useJson<Analytics>("/api/admin/crm/analytics", revision);
  const { data: team } = useJson<Team>("/api/admin/crm/stats", revision);
  if (error) return <p className="checkout-status">{error}</p>;
  if (!data) return <p className="adm-muted">{loading ? "Calculando…" : ""}</p>;
  const { forecast, grades } = data;
  const gradesTotal = grades.A + grades.B + grades.C;

  return <>
    <section className="adm-metrics adm-metrics-4">
      <Metric label="Pronóstico ponderado" value={formatMoneyCompact(forecast.weightedInCents)} hint={`sobre ${formatMoneyCompact(forecast.valueInCents)} en ${plural(forecast.deals, "oportunidad abierta", "oportunidades abiertas")}`} tone="good" />
      <Metric label="Oportunidades A" value={grades.A} hint={gradesTotal ? `${Math.round((grades.A / gradesTotal) * 100)} % de las activas · B: ${grades.B} · C: ${grades.C}` : "Sin oportunidades calificadas"} />
      <Metric label="Respuesta por WhatsApp" value={data.channels[0].answerRate === null ? "—" : `${data.channels[0].answerRate}%`} hint={`${data.channels[0].contacts} contactos · ${data.channels[0].attempts} intentos (90 días)`} />
      <Metric label="Propuesta → Ganado" value={data.conversion[2].rate === null ? "—" : `${data.conversion[2].rate}%`} hint={`${data.conversion[2].to} de ${data.conversion[2].from} en 6 meses`} />
    </section>

    <section className="adm-two-col">
      <article className="panel">
        <div className="panel-header"><h2>Pronóstico por mes de cierre</h2><span>Valor × probabilidad de la etapa</span></div>
        <ColumnChart data={forecast.byMonth.map((row) => ({ mes: monthLabel(row.month), ponderado: row.weightedInCents }))} x="mes" y="ponderado" money highlightLast={false} />
        <p className="adm-muted adm-small">Probabilidades: Contactado 15 % · Reunión 35 % · Propuesta 60 %. Define el “cierre esperado” en el estudio del colegio para ubicarlo en el mes.</p>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Conversión entre etapas</h2><span>Últimos 6 meses</span></div>
        <ul className="adm-steps">{data.conversion.map((step) => <li key={step.step}><div><strong>{step.step}</strong><small>{step.to} de {step.from}</small></div><b>{step.rate === null ? "—" : `${step.rate}%`}</b><i style={{ width: `${step.rate ?? 0}%` }} /></li>)}</ul>
        <h3 className="adm-subhead">Días promedio en cada etapa</h3>
        <ul className="adm-plain-list">{data.daysInStage.map((row) => <li key={row.stage}><span>{row.label}<small>{row.samples ? plural(row.samples, "caso", "casos") : "sin datos aún"}</small></span><strong>{row.avgDays === null ? "—" : `${row.avgDays} d`}</strong></li>)}</ul>
      </article>
    </section>

    <section className="adm-two-col">
      <article className="panel">
        <div className="panel-header"><h2>Colegios por ciudad</h2><span>Base, trabajados, abiertos y ganados</span></div>
        <div className="sales-table-scroll"><table className="admin-table adm-table adm-stats"><thead><tr><th>Ciudad</th><th>Base</th><th>Trabajados</th><th>Abiertas</th><th>Ganadas</th><th>Valor abierto</th></tr></thead>
          <tbody>{data.byCity.map((row) => <tr key={row.city}><td><strong>{row.city}</strong></td><td>{row.total.toLocaleString("es-CO")}</td><td>{row.worked}{row.total ? <small>{Math.round((row.worked / row.total) * 100)} %</small> : null}</td><td>{row.open}</td><td className="is-positive">{row.won}</td><td>{row.valueInCents ? formatMoneyCompact(row.valueInCents) : "—"}</td></tr>)}</tbody></table></div>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Efectividad por canal</h2><span>Contactos logrados vs. intentos (90 días)</span></div>
        <table className="admin-table adm-table adm-stats"><thead><tr><th>Canal</th><th>Contactos</th><th>Intentos</th><th>Respuesta</th></tr></thead>
          <tbody>{data.channels.map((row) => <tr key={row.channel}><td>{row.label}</td><td>{row.contacts}</td><td>{row.attempts}</td><td><strong>{row.answerRate === null ? "—" : `${row.answerRate}%`}</strong></td></tr>)}</tbody></table>
        <h3 className="adm-subhead">Contactos entrantes por semana</h3>
        <ColumnChart data={data.inboundByWeek.map((row) => ({ semana: weekLabel(row.week), contactos: row.total }))} x="semana" y="contactos" unit="contactos" height={150} />
      </article>
    </section>

    <section className="adm-two-col">
      <article className="panel">
        <div className="panel-header"><h2>Programas de interés</h2><span>Según el estudio del colegio</span></div>
        {data.byProgram.length ? <HBarChart data={data.byProgram.map((row) => ({ programa: row.program.length > 28 ? `${row.program.slice(0, 27)}…` : row.program, colegios: row.total }))} x="programa" y="colegios" labelWidth={190} /> : <div className="adm-empty"><strong>Sin programas registrados</strong><span>Completa “Programa de interés” en el estudio de cada colegio.</span></div>}
        <h3 className="adm-subhead">Por sector</h3>
        <ul className="adm-plain-list">{data.bySector.map((row) => <li key={row.sector}><span>{sectorLabel(row.sector) ?? "Sin dato"}<small>{row.students ? `${row.students.toLocaleString("es-CO")} estudiantes registrados` : ""}</small></span><span className="adm-muted">{row.won} ganados</span><strong>{row.total.toLocaleString("es-CO")}</strong></li>)}</ul>
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Rendimiento por asesor</h2><span>Según responsable del contacto</span></div>
        {team?.owners.length ? <div className="sales-table-scroll"><table className="admin-table adm-table adm-stats">
          <thead><tr><th>Asesor</th><th>Asignados</th><th>Abiertas</th><th>Gestiones 7 d / 30 d</th><th>Ganadas 30 d</th><th>Perdidas 30 d</th><th>Vencidos</th></tr></thead>
          <tbody>{team.owners.map((row) => <tr key={row.owner}><td><strong>{row.owner}</strong></td><td>{row.assigned.toLocaleString("es-CO")}</td><td>{row.open}{row.valueInCents > 0 && <small>{formatMoneyCompact(row.valueInCents)}</small>}</td><td>{row.touchesWeek} / {row.touchesMonth}</td><td className="is-positive">{row.won30}{row.wonValueInCents30 > 0 && <small>{formatMoneyCompact(row.wonValueInCents30)}</small>}</td><td>{row.lost30}</td><td className={row.due ? "is-due" : undefined}>{row.due}</td></tr>)}</tbody>
        </table></div> : <p className="adm-muted">Asigna responsables para ver el rendimiento de cada asesor.</p>}
        <h3 className="adm-subhead">Conversión por canal de origen</h3>
        {team?.sources.length ? <div className="sales-table-scroll"><table className="admin-table adm-table adm-stats"><thead><tr><th>Canal</th><th>Contactos</th><th>Abiertas</th><th>Ganadas</th><th>Cierre</th></tr></thead>
          <tbody>{team.sources.map((row) => <tr key={row.source}><td>{row.label}</td><td>{row.total.toLocaleString("es-CO")}</td><td>{row.open}</td><td className="is-positive">{row.won}</td><td>{row.winRate === null ? "—" : `${row.winRate}%`}</td></tr>)}</tbody></table></div> : null}
        {team && team.lostReasons.length > 0 && <><h3 className="adm-subhead">Motivos de pérdida</h3><ul className="adm-plain-list">{team.lostReasons.map((row) => <li key={row.reason}><span>{row.reason}</span><strong>{row.total}</strong></li>)}</ul></>}
        <p className="adm-muted adm-small">Presupuestos registrados: {(["menos_5m", "5_20m", "20_50m", "mas_50m"] as const).map((key) => budgetLabel(key)).join(" · ")}.</p>
      </article>
    </section>
  </>;
}
