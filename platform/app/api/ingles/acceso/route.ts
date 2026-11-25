import { cookies } from "next/headers";
import { z } from "zod";
import { sameOrigin } from "@/lib/admin-auth";
import { accessCookieOptions, accessCookieValue, cookieCodeIds, ENGLISH_COOKIE, getEnglishAccess, redeemCode } from "@/lib/english/access";
import { fail, handleError, ok, readBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().trim().min(1).max(40) });

/** Canjea el código de un libro: suma sus grados al acceso de este navegador. Con límite de intentos por IP. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Solicitud no permitida.", 403);
  const limited = await enforceRateLimit(request, { name: "english_code", limit: 10, globalLimit: 600, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const body = await readBody(request, schema, "Escribe el código de tu libro."); if (body instanceof Response) return body;
  try {
    const redeemed = await redeemCode(body.code);
    const ids = [...new Set([...(await cookieCodeIds()).filter((id) => id !== redeemed.id), redeemed.id])];
    (await cookies()).set(ENGLISH_COOKIE, accessCookieValue(ids), accessCookieOptions);
    const access = await getEnglishAccess();
    return ok({ ok: true, label: redeemed.label, grades: redeemed.grades, unlocked: [...new Set([...access.grades, ...redeemed.grades])].sort() });
  } catch (error) { return handleError(error, "english_code_failed", "No pudimos validar el código en este momento. Intenta de nuevo."); }
}

/** Cierra el acceso en este navegador (computadores compartidos del colegio). */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("Solicitud no permitida.", 403);
  (await cookies()).set(ENGLISH_COOKIE, "", { ...accessCookieOptions, maxAge: 0 });
  return ok();
}
