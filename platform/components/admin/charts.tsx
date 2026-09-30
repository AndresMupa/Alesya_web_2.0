"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

/**
 * Gráficas del panel: una sola serie por gráfica (magnitud en el tiempo o por categoría), un solo tono,
 * barras finas con punta redondeada, rejilla recesiva y tooltip en cada barra. El texto usa los tonos de
 * texto, nunca el color de la serie.
 */
type Row = Record<string, string | number>;
const axisTick = { fontSize: 11, fill: "#6a7482" };
const grid = "#e6e9ef";

function Tip({ active, payload, label, money, unit }: { active?: boolean; payload?: { value?: number | string }[]; label?: string | number; money?: boolean; unit?: string }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return <div className="adm-chart-tip"><strong>{money ? formatMoney(value) : `${value.toLocaleString("es-CO")}${unit ? ` ${unit}` : ""}`}</strong><span>{String(label)}</span></div>;
}

/** Columnas por periodo (semanas, días). La última columna es el periodo en curso y se resalta. */
export function ColumnChart({ data, x, y, money, unit, height = 190, highlightLast = true, goal }: { data: Row[]; x: string; y: string; money?: boolean; unit?: string; height?: number; highlightLast?: boolean; goal?: number }) {
  const total = data.reduce((acc, row) => acc + Number(row[y] ?? 0), 0);
  return <div className="adm-chart" style={{ height }}>
    {!total && <p className="adm-chart-empty">Sin datos todavía en este periodo.</p>}
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey={x} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={money ? 58 : 32} allowDecimals={false} tickFormatter={(value: number) => money ? formatMoneyCompact(value).replace(/\s/g, "") : value.toLocaleString("es-CO")} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,.05)" }} content={<Tip money={money} unit={unit} />} />
        <Bar dataKey={y} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {data.map((row, index) => <Cell key={String(row[x])} fill={highlightLast && index === data.length - 1 ? "var(--adm-chart-strong)" : goal && Number(row[y]) >= goal ? "var(--adm-chart-strong)" : "var(--adm-chart)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

/** Barras horizontales por categoría (etapas del embudo, productos). */
export function HBarChart({ data, x, y, money, unit, labelWidth = 150 }: { data: Row[]; x: string; y: string; money?: boolean; unit?: string; labelWidth?: number }) {
  const height = Math.max(120, data.length * 34 + 16);
  const total = data.reduce((acc, row) => acc + Number(row[y] ?? 0), 0);
  return <div className="adm-chart" style={{ height }}>
    {!total && <p className="adm-chart-empty">Sin datos todavía.</p>}
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke={grid} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(value: number) => money ? formatMoneyCompact(value).replace(/\s/g, "") : value.toLocaleString("es-CO")} />
        <YAxis type="category" dataKey={x} tick={axisTick} axisLine={false} tickLine={false} width={labelWidth} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,.05)" }} content={<Tip money={money} unit={unit} />} />
        <Bar dataKey={y} fill="var(--adm-chart)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "#3a4452", formatter: (label: React.ReactNode) => money ? formatMoneyCompact(Number(label)) : Number(label).toLocaleString("es-CO") }} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
