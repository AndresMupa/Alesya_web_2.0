import "server-only";
import type { z } from "zod";

export const noStore = { "Cache-Control": "private, no-store" };

export const fail = (message: string, status = 400) => Response.json({ message }, { status, headers: noStore });
export const ok = (body: Record<string, unknown> = { ok: true }, status = 200) => Response.json(body, { status, headers: noStore });

/** Lee y valida el cuerpo JSON. Devuelve los datos o una respuesta 400 con `message`. */
export async function readBody<T extends z.ZodTypeAny>(request: Request, schema: T, message = "Revisa los datos enviados."): Promise<z.infer<T> | Response> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
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
