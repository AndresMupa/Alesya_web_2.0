import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { handleError, noStore, ok, readBody } from "@/lib/http";
import { mailStatus, renderEmail, sendMail } from "@/lib/mail";
import { getSettings, saveSettings } from "@/lib/settings";

const schema = z.object({
  "store.whatsapp": z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, "WhatsApp no válido").optional(),
  "store.payment_instructions": z.string().trim().min(10).max(2000).optional(),
  "store.shipping_default_cop": z.string().trim().regex(/^\d{0,9}$/).optional(),
  "store.shipping_note": z.string().trim().max(300).optional(),
  "mail.notify_to": z.union([z.string().trim().email().max(180), z.literal("")]).optional(),
  "crm.daily_goal": z.string().trim().regex(/^\d{1,4}$/).optional(),
});

export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json({ settings: await getSettings(), mail: mailStatus() }, { headers: noStore }); }
  catch (error) { return handleError(error, "settings_read_failed", "No se pudo leer la configuración."); }
}

export async function PUT(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Revisa los datos: WhatsApp con indicativo, instrucciones de al menos 10 caracteres y envío en pesos sin puntos."); if (body instanceof Response) return body;
  try { await saveSettings(body); return ok({ ok: true, settings: await getSettings() }); }
  catch (error) { return handleError(error, "settings_save_failed", "No se pudo guardar la configuración."); }
}

/** Envía un correo de prueba a la dirección de avisos para comprobar las credenciales SMTP. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  try {
    const values = await getSettings();
    const to = values["mail.notify_to"] || admin.email;
    const mail = renderEmail({ title: "Correo de prueba", intro: "Si lees esto, el correo transaccional de la tienda Alesya está funcionando.", rows: [["Servidor", mailStatus().host ?? "—"], ["Remitente", mailStatus().from ?? "—"]] });
    const result = await sendMail({ to, subject: "Prueba de correo · Alesya", ...mail });
    return result.sent ? ok({ ok: true, to }) : Response.json({ message: result.reason ?? "No se pudo enviar." }, { status: 503 });
  } catch (error) { return handleError(error, "settings_test_mail_failed", "No se pudo enviar el correo de prueba."); }
}
