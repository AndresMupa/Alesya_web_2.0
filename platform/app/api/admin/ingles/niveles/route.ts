import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { GRADES } from "@/lib/english/levels";
import { saveLevel } from "@/lib/english/resources";
import { handleError, ok, readBody } from "@/lib/http";

const schema = z.object({
  grade: z.number().int().refine((value) => GRADES.includes(value as never)).transform((value) => value as (typeof GRADES)[number]),
  tagline: z.string().trim().max(60),
  description: z.string().trim().max(400),
});

/** Frase y descripción de un grado. En blanco = texto por defecto. */
export async function PUT(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Revisa el texto del grado."); if (body instanceof Response) return body;
  try { await saveLevel(body.grade, body.tagline, body.description); return ok(); }
  catch (error) { return handleError(error, "english_level_save_failed", "No se pudo guardar el texto del grado."); }
}
