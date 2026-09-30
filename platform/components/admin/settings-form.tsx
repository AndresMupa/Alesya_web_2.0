"use client";

import { FormEvent, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { send, useJson } from "@/components/admin/kit";

type Data = { settings: Record<string, string>; mail: { configured: boolean; host: string | null; port: number; from: string | null; devPreview: boolean } };

/** Configuración de la tienda: WhatsApp, instrucciones de pago manual, envío por defecto y correo de avisos. */
export function SettingsForm() {
  const [revision, setRevision] = useState(0);
  const { data, error } = useJson<Data>("/api/admin/settings", revision);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await send("/api/admin/settings", "PUT", Object.fromEntries(new FormData(event.currentTarget)), "Configuración guardada.");
    setSaving(false);
    if (result) setRevision((value) => value + 1);
  }

  async function testMail() {
    setTesting(true);
    const result = await send<{ to: string }>("/api/admin/settings", "POST", {});
    setTesting(false);
    if (result) toast.success(`Correo de prueba enviado a ${result.to}.`);
  }

  if (error) return <p className="checkout-status">{error}</p>;
  if (!data) return <p className="adm-muted">Cargando…</p>;
  const values = data.settings;
  return <form className="panel adm-section adm-form adm-settings" onSubmit={submit} key={revision}>
    <h2>Tienda</h2>
    <div className="adm-form-grid">
      <label>WhatsApp comercial<input name="store.whatsapp" defaultValue={values["store.whatsapp"]} placeholder="573005937840" maxLength={16} /><small>Con indicativo 57. Se usa en la tienda, en los correos y en las plantillas.</small></label>
      <label>Envío por defecto (COP)<input name="store.shipping_default_cop" type="number" min="0" step="1000" defaultValue={values["store.shipping_default_cop"]} /><small>0 = el envío se coordina después del pago y no se suma al total.</small></label>
    </div>
    <label>Nota de envío<input name="store.shipping_note" defaultValue={values["store.shipping_note"]} maxLength={300} /><small>Aparece en la ficha de producto y en los correos.</small></label>
    <label>Instrucciones de pago manual<textarea name="store.payment_instructions" defaultValue={values["store.payment_instructions"]} rows={4} minLength={10} maxLength={2000} /><small>Se muestran al cliente cuando el pedido queda pendiente sin Wompi (página de resultado, correo y plantilla de WhatsApp). Puedes poner la cuenta bancaria y el Nequi.</small></label>

    <h2>Máquina de ventas</h2>
    <label>Meta diaria de gestiones por asesor<input name="crm.daily_goal" type="number" min="1" max="9999" defaultValue={values["crm.daily_goal"]} /><small>Llamadas, WhatsApp, correos, reuniones e intentos que cuentan cada día. Se muestra como barra de avance en la máquina de ventas.</small></label>

    <h2><Mail size={17} /> Correo</h2>
    <label>Correo de avisos del equipo<input name="mail.notify_to" type="email" defaultValue={values["mail.notify_to"]} maxLength={180} /><small>Recibe los pedidos nuevos y los contactos del formulario; es el “responder a” de los correos al cliente.</small></label>
    <p className={`adm-callout${data.mail.configured ? " is-ok" : ""}`}>
      {data.mail.configured ? <>Correo transaccional activo: envía desde <strong>{data.mail.from}</strong> por {data.mail.host}:{data.mail.port}.</> : data.mail.devPreview ? <>Sin SMTP: en desarrollo los correos se imprimen en la consola del servidor en lugar de enviarse.</> : <>Sin SMTP: no se envían correos. En cPanel crea una cuenta (Cuentas de correo) y define <code>SMTP_HOST</code>, <code>SMTP_PORT</code> (465), <code>SMTP_USER</code>, <code>SMTP_PASS</code> y <code>MAIL_FROM</code> en “Setup Node.js App”.</>}
    </p>
    <div className="adm-actions-row">
      <button className="button button-dark" type="submit" disabled={saving}>Guardar configuración</button>
      <button className="refresh-button" type="button" disabled={testing || (!data.mail.configured && !data.mail.devPreview)} onClick={() => void testMail()}><Send size={14} /> {testing ? "Enviando…" : "Enviar correo de prueba"}</button>
    </div>
  </form>;
}
