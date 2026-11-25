import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { createCodes } from "@/lib/english/access";
import { GRADES } from "@/lib/english/levels";
import { listCodes } from "@/lib/english/resources";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";

const schema = z.object({
  label: z.string().trim().min(2, "Ponle un nombre al lote (p. ej. Colegio San José · 3°A · 2027).").max(120),
  grades: z.array(z.number().int().refine((value) => GRADES.includes(value as never))).min(1, "Elige al menos un grado.").transform((value) => value as (typeof GRADES)[number][]),
  count: z.number().int().min(1).max(500),
  maxUses: z.number().int().min(1).max(100000).nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  customCode: z.string().trim().max(40).optional(),
});

export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try {
    const now = Date.now();
    const codes = (await listCodes()).map((code) => ({ ...code, expired: !!code.expiresAt && code.expiresAt.getTime() <= now }));
    return Response.json({ codes }, { headers: noStore });
  }
  catch (error) { return handleError(error, "english_codes_list_failed", "No se pudieron cargar los códigos."); }
}

/** Crea un lote de códigos (o uno con nombre propio). El vencimiento es al final del día indicado, hora de Colombia. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, schema, "Revisa los datos de los códigos."); if (body instanceof Response) return body;
  try {
    const expiresAt = body.expiresAt ? new Date(`${body.expiresAt}T23:59:59-05:00`) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) return fail("La fecha de vencimiento ya pasó.");
    const codes = await createCodes({ label: body.label, grades: body.grades, count: body.customCode ? 1 : body.count, maxUses: body.maxUses, expiresAt, customCode: body.customCode || undefined });
    return ok({ ok: true, codes }, 201);
  } catch (error) { return handleError(error, "english_codes_create_failed", "No se pudieron crear los códigos."); }
}
