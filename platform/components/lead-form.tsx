"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { readTouch } from "@/components/attribution-capture";
import { formAttribution } from "@/lib/crm/constants";
import { CURRENT_MARKETING_CONSENT, dataConsentTexts, marketingConsentTexts, type DataConsentVersion } from "@/lib/crm/consent";
import { budgetRanges, calendars, roboticsPlatforms, sectors, techLevels } from "@/lib/crm/score";

/** Niveles que ve el colegio; "Bachillerato" agrupa secundaria y media del estudio del colegio en el CRM. */
const gradeOptions = [{ label: "Preescolar", value: "preescolar" }, { label: "Primaria", value: "primaria" }, { label: "Bachillerato", value: "secundaria,media" }];

type SendState = "idle" | "saving" | "done" | "error";

/** Envía el formulario a `/api/leads` con la autorización de datos, la de comunicaciones comerciales (con la versión de cada texto) y el primer toque. */
function useLeadSubmit(consentVersion: DataConsentVersion, extra: (form: FormData) => Record<string, unknown>) {
  const [state, setState] = useState<SendState>("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const form = new FormData(event.currentTarget);
    const touch = readTouch();
    const data = {
      ...Object.fromEntries(form),
      ...extra(form),
      consent: form.get("consent") === "on", consentVersion,
      marketingConsent: form.get("marketing") === "on", marketingConsentVersion: CURRENT_MARKETING_CONSENT,
      ...formAttribution(touch.utmSource, touch.utmCampaign), attribution: touch,
    };
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  return { state, submit };
}

/** El texto de la autorización viene de lib/crm/consent.ts (con su versión); aquí solo se enlaza la política. */
function ConsentText({ text }: { text: string }) {
  const [before, after] = text.split("Política de datos personales");
  return after === undefined ? <>{text}</> : <>{before}<Link href="/politica-de-privacidad" target="_blank">Política de datos personales</Link>{after}</>;
}

/** Dos casillas separadas: la autorización de datos (obligatoria) y las comunicaciones comerciales (opcional, sin marcar). */
function ConsentFields({ version }: { version: DataConsentVersion }) {
  return <>
    <label className="consent-check"><input type="checkbox" name="consent" required /><span><ConsentText text={dataConsentTexts[version]} /></span></label>
    <label className="consent-check"><input type="checkbox" name="marketing" /><span>{marketingConsentTexts[CURRENT_MARKETING_CONSENT]}</span></label>
  </>;
}

const selectOptions = (list: readonly { value: string; label: string }[]) => list.map((item) => <option key={item.value} value={item.value}>{item.label}</option>);

/**
 * Formulario de diagnóstico para colegios: crea el contacto en el CRM con la red o campaña de origen, la autorización
 * de datos y la calificación opcional (grados, estudiantes y el estudio del colegio que alimenta el puntaje).
 * `program` es el programa de la página (p. ej. "Robótica").
 */
export function LeadForm({ program }: { program?: string }) {
  const { state, submit } = useLeadSubmit("datos-diagnostico-v1-borrador", (form) => ({
    grades: form.getAll("grades").flatMap((value) => String(value).split(",")), program,
  }));
  if (state === "done") return <div className="lead-form lead-success" role="status"><CheckCircle2 /><h3>¡Gracias! Recibimos tu solicitud.</h3><p>Una persona del equipo te escribirá el mismo día hábil por correo o WhatsApp para conocer tu institución y agendar el diagnóstico.</p></div>;
  return <form className="lead-form" onSubmit={submit}>
    <span className="form-kicker">Hablemos de tu institución</span>
    <h3>Diseñemos una ruta para tu comunidad.</h3>
    <label>Nombre<input required name="name" autoComplete="name" placeholder="Tu nombre" maxLength={120} /></label>
    <label>Institución<input required name="organization" autoComplete="organization" placeholder="Colegio u organización" maxLength={160} /></label>
    <label>Correo<input required type="email" name="email" autoComplete="email" placeholder="nombre@institucion.edu.co" maxLength={180} /></label>
    <label>Celular (opcional)<input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="300 000 0000" /></label>
    <fieldset className="lead-grades"><legend>Grados de interés (opcional)</legend><div>
      {gradeOptions.map((option) => <label key={option.value}><input type="checkbox" name="grades" value={option.value} />{option.label}</label>)}
    </div></fieldset>
    <label>Número aproximado de estudiantes (opcional)<input type="number" name="students" inputMode="numeric" min={1} max={50000} step={1} placeholder="350" /></label>
    <details className="lead-optional">
      <summary>Para preparar mejor tu diagnóstico (opcional)</summary>
      <label>Tipo de institución<select name="sector" defaultValue=""><option value="">Prefiero no decir</option>{selectOptions(sectors)}</select></label>
      <label>Calendario<select name="calendar" defaultValue=""><option value="">Prefiero no decir</option>{selectOptions(calendars)}</select></label>
      <label>¿Qué tanto trabajan hoy robótica o programación?<select name="techLevel" defaultValue=""><option value="">Prefiero no decir</option>{selectOptions(techLevels)}</select></label>
      <label>¿Qué plataforma de robótica usan hoy?<select name="competitors" defaultValue=""><option value="">Ninguna o prefiero no decir</option>{roboticsPlatforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select></label>
      <label>Presupuesto estimado para el año<select name="budgetRange" defaultValue=""><option value="">Prefiero no decir</option>{selectOptions(budgetRanges.filter((range) => range.value !== "desconocido"))}</select></label>
    </details>
    <label>¿Qué necesitas?<textarea required name="message" placeholder="Cuéntanos tus objetivos o el reto que quieres resolver" rows={3} minLength={8} maxLength={2000} /></label>
    <ConsentFields version="datos-diagnostico-v1-borrador" />
    <button disabled={state === "saving"} className="button button-primary" type="submit">{state === "saving" ? "Enviando…" : "Solicitar diagnóstico"} <ArrowRight size={18} /></button>
    {state === "error" && <p className="form-error" role="alert">No pudimos enviar la solicitud. Intenta de nuevo o escríbenos por WhatsApp.</p>}
  </form>;
}

/**
 * Lista de espera de un producto agotado: crea un contacto en el CRM con el producto de interés (el servidor lo verifica contra el catálogo)
 * para medir la demanda antes de importar y avisar cuando haya disponibilidad.
 */
export function WaitlistForm({ productSlug, productName }: { productSlug: string; productName: string }) {
  const { state, submit } = useLeadSubmit("datos-lista-espera-v1-borrador", () => ({ productSlug }));
  if (state === "done") return <div className="waitlist-form waitlist-done" role="status"><CheckCircle2 size={22} /><div><strong>Listo, quedaste en la lista de espera.</strong><p>Te escribiremos cuando {productName} esté disponible. Todavía no tenemos una fecha confirmada.</p></div></div>;
  return <form className="waitlist-form" onSubmit={submit}>
    <h2>Avísame cuando llegue</h2>
    <p>Déjanos tus datos y te escribimos cuando haya disponibilidad.</p>
    <label>Nombre<input required name="name" autoComplete="name" maxLength={120} /></label>
    <label>Correo<input required type="email" name="email" autoComplete="email" maxLength={180} /></label>
    <div className="waitlist-row">
      <label>Celular (opcional)<input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} /></label>
      <label>Cantidad (opcional)<input type="number" name="quantity" inputMode="numeric" min={1} max={999} step={1} /></label>
    </div>
    <ConsentFields version="datos-lista-espera-v1-borrador" />
    <button disabled={state === "saving"} className="button button-dark" type="submit">{state === "saving" ? "Enviando…" : "Anotarme en la lista"}</button>
    {state === "error" && <p className="form-error" role="alert">No pudimos anotarte. Intenta de nuevo o escríbenos por WhatsApp.</p>}
  </form>;
}
