"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

/** Confirmación de la baja: la acción es un POST (no un GET) para que los antivirus y vistas previas de los correos no den de baja a nadie. */
export function UnsubscribeForm({ token, optedOut }: { token: string; optedOut: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(optedOut ? "done" : "idle");
  async function confirm() {
    setState("saving");
    try {
      const response = await fetch(`/api/baja/${token}`, { method: "POST" });
      setState(response.ok ? "done" : "error");
    } catch { setState("error"); }
  }
  if (state === "done") return <div className="baja-card" role="status"><CheckCircle2 size={28} /><h2>Listo, ya no te escribiremos.</h2><p>No volveremos a enviarte correos ni mensajes de WhatsApp con fines comerciales. Si tienes una solicitud o un pedido en curso, te seguiremos contactando solo para atenderlo.</p></div>;
  return <div className="baja-card">
    <h2>¿Quieres dejar de recibir nuestras comunicaciones comerciales?</h2>
    <p>Confirma y dejaremos de enviarte novedades, guías y ofertas por correo y WhatsApp.</p>
    <button type="button" className="button button-dark" disabled={state === "saving"} onClick={confirm}>{state === "saving" ? "Procesando…" : "Sí, darme de baja"}</button>
    {state === "error" && <p className="form-error" role="alert">No pudimos procesar la baja. Intenta de nuevo o escríbenos por correo.</p>}
  </div>;
}
