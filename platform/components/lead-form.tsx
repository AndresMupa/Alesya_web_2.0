"use client";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
export function LeadForm() {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source");
    const campaign = params.get("utm_campaign") ?? "";
    data.source = source && ["linkedin", "instagram", "facebook", "whatsapp"].includes(source) ? source : "website";
    data.campaign = /^[a-zA-Z0-9_-]{0,40}$/.test(campaign) ? campaign : "";
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done") return <div className="lead-form lead-success"><CheckCircle2 /><h3>Solicitud recibida</h3><p>La oportunidad ya quedó registrada para seguimiento comercial.</p></div>;
  return <form className="lead-form" onSubmit={submit}><span className="form-kicker">Hablemos de tu institución</span><h3>Diseñemos una ruta para tu comunidad.</h3><label>Nombre<input required name="name" placeholder="Tu nombre" /></label><label>Institución<input required name="organization" placeholder="Colegio u organización" /></label><label>Correo<input required type="email" name="email" placeholder="nombre@institucion.edu.co" /></label><label>Celular (opcional)<input type="tel" name="phone" inputMode="tel" maxLength={30} placeholder="300 000 0000" /></label><label>¿Qué necesitas?<textarea required name="message" placeholder="Cuéntanos sobre estudiantes, grados y objetivos" rows={3} /></label><button disabled={state === "saving"} className="button button-primary" type="submit">{state === "saving" ? "Guardando…" : "Solicitar diagnóstico"} <ArrowRight size={18} /></button>{state === "error" && <p className="form-error">No pudimos guardar la solicitud. Intenta de nuevo.</p>}</form>;
}
