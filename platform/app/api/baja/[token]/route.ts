import { UNSUBSCRIBE_TOKEN, optOutByToken } from "@/lib/crm/leads";
import { fail, handleError, ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Baja de comunicaciones comerciales. El token del enlace es la credencial, así que no se exige sesión ni origen: también atiende el
 * "un clic" de los clientes de correo (RFC 8058), que publican directamente a esta dirección.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await enforceRateLimit(request, { name: "unsubscribe", limit: 20, globalLimit: 500, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const { token } = await params;
  if (!UNSUBSCRIBE_TOKEN.test(token)) return fail("Enlace de baja no válido.", 404);
  try {
    const result = await optOutByToken(token);
    return result ? ok({ ok: true }) : fail("Enlace de baja no válido.", 404);
  } catch (error) { return handleError(error, "unsubscribe_failed", "No pudimos procesar la baja. Intenta de nuevo."); }
}
