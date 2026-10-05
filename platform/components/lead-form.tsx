"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

/** Formulario de diagnóstico para colegios: crea el contacto en el CRM con la red o campaña de origen. */
export function LeadForm() {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    delete data.consent;
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
  if (state === "done") return <div className="lead-form lead-success" role="status"><CheckCircle2 /><h3>¡Gracias! Recibimos tu solicitud.</h3><p>Una persona del equipo te escribirá por correo o WhatsApp para conocer tu institución y agendar el diagnóstico.</p></div>;
  return <form className="lead-form" onSubmit={submit}>
    <span className="form-kicker">Hablemos de tu institución</span>
    <h3>Diseñemos una ruta para tu comunidad.</h3>
    <label>Nombre<input required name="name" autoComplete="name" placeholder="Tu nombre" maxLength={120} /></label>
    <label>Institución<input required name="organization" autoComplete="organization" placeholder="Colegio u organización" maxLength={160} /></label>
    <label>Correo<input required type="email" name="email" autoComplete="email" placeholder="nombre@institucion.edu.co" maxLength={180} /></label>
    <label>Celular (opcional)<input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="300 000 0000" /></label>
    <label>¿Qué necesitas?<textarea required name="message" placeholder="Cuéntanos sobre estudiantes, grados y objetivos" rows={3} minLength={8} maxLength={2000} /></label>
    <label className="consent-check"><input type="checkbox" name="consent" required /><span>Autorizo el tratamiento de mis datos para recibir el diagnóstico y propuestas, según la <Link href="/politica-de-privacidad" target="_blank">Política de datos personales</Link>.</span></label>
    <button disabled={state === "saving"} className="button button-primary" type="submit">{state === "saving" ? "Enviando…" : "Solicitar diagnóstico"} <ArrowRight size={18} /></button>
    {state === "error" && <p className="form-error" role="alert">No pudimos enviar la solicitud. Intenta de nuevo o escríbenos por WhatsApp.</p>}
  </form>;
}
