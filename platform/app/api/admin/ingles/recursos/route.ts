import { authorizeAdmin } from "@/lib/admin-auth";
import { isGrade } from "@/lib/english/levels";
import { createResource, listAdminResources } from "@/lib/english/resources";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";
import { resourceSchema } from "./schema";

/** Material de un grado (`?grado=3`), publicado y en borrador, en el orden en que lo ve el público. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const grade = Number(new URL(request.url).searchParams.get("grado"));
  if (!isGrade(grade)) return fail("Elige un grado de 1 a 5.");
  try { return Response.json({ resources: await listAdminResources(grade) }, { headers: noStore }); }
  catch (error) { return handleError(error, "english_resources_list_failed", "No se pudo cargar el material."); }
}

export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, resourceSchema, "Revisa los datos del material."); if (body instanceof Response) return body;
  try { return ok({ ok: true, id: await createResource(body) }, 201); }
  catch (error) { return handleError(error, "english_resource_create_failed", "No se pudo guardar el material."); }
}
