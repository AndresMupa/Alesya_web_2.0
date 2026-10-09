import { syncInbox } from "@/lib/crm/inbox";
import { cronAuthorized } from "@/lib/cron";
import { noStore } from "@/lib/http";

/**
 * Captación por correo (llamar cada 10 minutos desde un cron de cPanel con `?token=CRON_SECRET`): revisa el buzón
 * comercial y lleva los correos nuevos al CRM. Responde lo que hizo; sin IMAP_* configurado no hace nada.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ message: "No autorizado" }, { status: 401, headers: noStore });
  const result = await syncInbox();
  if (!result) return Response.json({ configured: false, reason: "Buzón no configurado (IMAP_*)." }, { headers: noStore });
  return Response.json({ configured: true, ...result }, { status: result.ok ? 200 : 502, headers: noStore });
}
