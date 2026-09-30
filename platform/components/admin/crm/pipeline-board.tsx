"use client";

import { useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { send } from "@/components/admin/kit";
import { leadPriorityLabel, lostReasons } from "@/lib/crm/constants";
import { bogotaDay, daysSince, formatDay, formatMoneyCompact } from "@/lib/format";

/** Días en la misma etapa a partir de los cuales una oportunidad abierta se marca como estancada. */
const STALE_DAYS = 14;

export type PipelineCard = { id: string; name: string; organization: string; city: string | null; stage: string; priority: string; owner: string | null; estimatedValueInCents: number; nextFollowUp: string | null; lastContact: string | null; source: string; phone: string | null; email: string | null; stageChangedAt: string | null };
export type PipelineColumn = { stage: string; label: string; cards: PipelineCard[]; total: number; valueInCents: number };

const hints: Record<string, string> = { new: "Entrantes sin atender", contacted: "Primer contacto hecho", meeting: "Reunión agendada o hecha", proposal: "Propuesta enviada", won: "Últimos 60 días", lost: "Últimos 60 días" };

/** Embudo por etapas. Arrastra una tarjeta a otra columna para cambiar su etapa (queda en el historial). */
export function PipelineBoard({ columns, onOpen, onMoved }: { columns: PipelineColumn[]; onOpen: (id: string) => void; onMoved: () => void }) {
  const dragged = useRef<PipelineCard | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [pendingLoss, setPendingLoss] = useState<PipelineCard | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState(columns);
  // Datos nuevos del servidor reemplazan los movimientos optimistas (patrón "ajustar estado al cambiar props").
  if (columns !== seen) { setSeen(columns); setMoved({}); }
  const today = bogotaDay();

  async function move(card: PipelineCard, stage: string, lostReason?: string) {
    setMoved((current) => ({ ...current, [card.id]: stage }));
    const result = await send(`/api/admin/crm/leads/${card.id}`, "PATCH", { stage, ...(lostReason && { lostReason }) }, `${card.organization} → ${columns.find((column) => column.stage === stage)?.label}.`);
    if (!result) setMoved((current) => { const next = { ...current }; delete next[card.id]; return next; });
    onMoved();
  }

  function drop(stage: string) {
    const card = dragged.current;
    dragged.current = null;
    setTarget(null);
    if (!card || (moved[card.id] ?? card.stage) === stage) return;
    if (stage === "lost") setPendingLoss(card);
    else void move(card, stage);
  }

  // Tarjetas movidas en esta sesión aparecen en su nueva columna mientras llega la recarga.
  const all = columns.flatMap((column) => column.cards);
  const cardsFor = (stage: string) => all.filter((card) => (moved[card.id] ?? card.stage) === stage);

  return <>
    <div className="adm-pipeline">
      {columns.map((column) => {
        const cards = cardsFor(column.stage);
        return <section key={column.stage} className={`adm-pipe-col${target === column.stage ? " is-target" : ""}`} data-stage={column.stage}
          onDragOver={(event) => { event.preventDefault(); setTarget(column.stage); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setTarget((current) => (current === column.stage ? null : current)); }}
          onDrop={(event) => { event.preventDefault(); drop(column.stage); }}>
          <header><div><h3>{column.label}</h3><small>{hints[column.stage]}</small></div><div className="adm-pipe-totals"><b>{column.total.toLocaleString("es-CO")}</b>{column.valueInCents > 0 && <small>{formatMoneyCompact(column.valueInCents)}</small>}</div></header>
          <div className="adm-pipe-cards">
            {cards.map((card) => {
              const due = card.nextFollowUp && card.nextFollowUp <= today && !["won", "lost"].includes(card.stage);
              const inStage = daysSince(card.stageChangedAt);
              const stale = inStage >= STALE_DAYS && ["contacted", "meeting", "proposal"].includes(card.stage);
              return <article key={card.id} className={`adm-pipe-card${stale ? " is-stale" : ""}`} draggable data-priority={card.priority}
                onDragStart={(event) => { dragged.current = card; event.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { dragged.current = null; setTarget(null); }}
                onClick={() => onOpen(card.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(card.id); }} tabIndex={0} role="button" aria-label={`Abrir ${card.organization}`}>
                <strong>{card.organization}</strong>
                <span>{card.name}{card.city && ` · ${card.city}`}</span>
                <div className="adm-pipe-meta">
                  <i title={`Prioridad ${leadPriorityLabel(card.priority).toLowerCase()}`} data-priority={card.priority} />
                  {card.estimatedValueInCents > 0 && <b>{formatMoneyCompact(card.estimatedValueInCents)}</b>}
                  {card.nextFollowUp && <em className={due ? "is-due" : undefined}><CalendarClock size={12} /> {formatDay(card.nextFollowUp)}</em>}
                  {stale && <em className="is-stale" title={`${inStage} días en ${column.label.toLowerCase()} sin avanzar`}>{inStage} d</em>}
                  {card.owner && <small title={card.owner}>{card.owner.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</small>}
                </div>
              </article>;
            })}
            {!cards.length && <p className="adm-pipe-empty">Arrastra aquí</p>}
            {column.total > column.cards.length && <p className="adm-pipe-more">+{(column.total - column.cards.length).toLocaleString("es-CO")} más en el CRM</p>}
          </div>
        </section>;
      })}
    </div>
    {pendingLoss && <div className="adm-modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingLoss(null); }}>
      <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Motivo de pérdida">
        <h3>¿Por qué se perdió {pendingLoss.organization}?</h3>
        <div className="adm-chip-row">{lostReasons.map((reason) => <button key={reason} type="button" className="adm-chip" onClick={() => { const card = pendingLoss; setPendingLoss(null); void move(card, "lost", reason); }}>{reason}</button>)}</div>
        <button type="button" className="adm-link-button" onClick={() => setPendingLoss(null)}>Cancelar</button>
      </div>
    </div>}
  </>;
}
