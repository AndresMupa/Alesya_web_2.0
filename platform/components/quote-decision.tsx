"use client";

import { useState } from "react";
import { CheckCircle2, Printer, XCircle } from "lucide-react";

/** Botones del enlace público: aceptar o rechazar la cotización (solo mientras está enviada y vigente) e imprimir. */
export function QuoteDecision({ token, decidable }: { token: string; decidable: boolean }) {
  const [state, setState] = useState<"idle" | "rejecting" | "saving" | "done" | "error">("idle");
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(choice: "accepted" | "rejected") {
    if (choice === "accepted" && !confirm("¿Confirmas que aceptas esta cotización? El equipo de Alesya se pondrá en contacto para coordinar el inicio.")) return;
    setState("saving");
    try {
      const response = await fetch(`/api/cotizacion/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: choice, note }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) { setMessage(body.message ?? "No se pudo registrar tu respuesta."); setState("error"); return; }
      setDecision(choice); setState("done");
    } catch { setMessage("Sin conexión. Intenta de nuevo."); setState("error"); }
  }

  if (state === "done") return <div className="quote-decided" data-decision={decision}>{decision === "accepted" ? <><CheckCircle2 size={22} /> ¡Gracias! Cotización aceptada. Te contactaremos para coordinar el inicio.</> : <><XCircle size={22} /> Respuesta registrada. Gracias por avisarnos.</>}</div>;
  const busy = state === "saving";

  return <div className="quote-actions print-hide">
    {decidable && <>
      <button type="button" className="button button-primary" disabled={busy} onClick={() => void submit("accepted")}><CheckCircle2 size={17} /> Aceptar cotización</button>
      {state === "rejecting" ? <form className="quote-reject" onSubmit={(event) => { event.preventDefault(); void submit("rejected"); }}><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="¿Qué ajustarías? (opcional)" /><button className="button button-dark" type="submit" disabled={busy}>Enviar respuesta</button></form>
        : <button type="button" className="button button-dark" onClick={() => setState("rejecting")}>No por ahora</button>}
    </>}
    <button type="button" className="refresh-button" onClick={() => window.print()}><Printer size={15} /> Imprimir o guardar PDF</button>
    {state === "error" && <p className="form-error">{message}</p>}
  </div>;
}
