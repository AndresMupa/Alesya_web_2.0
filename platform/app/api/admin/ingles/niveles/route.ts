import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { ACCESS_MODES, GRADES } from "@/lib/english/levels";
import { saveLevel, saveLevelAccessMode } from "@/lib/english/resources";
import { handleError, ok, readBody } from "@/lib/http";

const grade = z.number().int().refine((value) => GRADES.includes(value as never)).transform((value) => value as (typeof GRADES)[number]);

const schema = z.object({
  grade,
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

const accessSchema = z.object({ grade, accessMode: z.enum(ACCESS_MODES) });

/** Modo de acceso de un grado: "sample" (versión de muestra abierta) o "code" (requiere activación con código). */
export async function PATCH(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, accessSchema, "Elige un modo de acceso válido."); if (body instanceof Response) return body;
  try { await saveLevelAccessMode(body.grade, body.accessMode); return ok(); }
  catch (error) { return handleError(error, "english_access_mode_failed", "No se pudo cambiar el modo de acceso del grado."); }
}
