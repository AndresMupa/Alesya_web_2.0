import "server-only";
import type { z } from "zod";

export const noStore = { "Cache-Control": "private, no-store" };

export const fail = (message: string, status = 400) => Response.json({ message }, { status, headers: noStore });
export const ok = (body: Record<string, unknown> = { ok: true }, status = 200) => Response.json(body, { status, headers: noStore });

/** Tope de cuerpo para las rutas públicas: un formulario o un carrito pesan unos pocos KB. */
export const PUBLIC_BODY_LIMIT = 64_000;

/**
 * Lee y valida el cuerpo JSON. Devuelve los datos o una respuesta 400 con `message`. Con `maxBytes` rechaza (413) los cuerpos más
 * grandes antes de interpretarlos: las rutas públicas lo usan para no procesar cargas enormes de quien no ha iniciado sesión.
 */
export async function readBody<T extends z.ZodTypeAny>(request: Request, schema: T, message = "Revisa los datos enviados.", maxBytes?: number): Promise<z.infer<T> | Response> {
  let json: unknown = null;
  if (maxBytes) {
    if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return fail("La solicitud es demasiado grande.", 413);
    const text = await request.text().catch(() => "");
    if (text.length > maxBytes) return fail("La solicitud es demasiado grande.", 413);
    try { json = JSON.parse(text); } catch { json = null; }
  } else json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : fail(message);
}

/** Error esperado de una operación de dominio, con el estado HTTP que debe devolver la API. */
export class DomainError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

/** Convierte excepciones en respuestas: los `DomainError` pasan su mensaje; el resto se registra y responde 503. */
export function handleError(error: unknown, logKey: string, fallback: string) {
  if (error instanceof DomainError) return fail(error.message, error.status);
  console.error(logKey, error);
  return fail(fallback, 503);
}
