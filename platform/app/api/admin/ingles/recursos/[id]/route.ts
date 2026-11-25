import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { deleteResource, moveResource, setResourceStatus, updateResource } from "@/lib/english/resources";
import { handleError, ok, readBody } from "@/lib/http";
import { resourceSchema } from "../schema";

const patchSchema = z.union([z.object({ status: z.enum(["draft", "published"]) }), z.object({ move: z.enum(["up", "down"]) })]);

/** Guarda todos los datos de un material (desde la ficha del panel). */
export async function PUT(request: Request, { params }: RouteContext<"/api/admin/ingles/recursos/[id]">) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, resourceSchema, "Revisa los datos del material."); if (body instanceof Response) return body;
  try { await updateResource((await params).id, body); return ok(); }
  catch (error) { return handleError(error, "english_resource_update_failed", "No se pudo guardar el material."); }
}

/** Publicar u ocultar, o subir/bajar un puesto. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/ingles/recursos/[id]">) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, patchSchema); if (body instanceof Response) return body;
  const { id } = await params;
  try {
    if ("status" in body) await setResourceStatus(id, body.status);
    else await moveResource(id, body.move);
    return ok();
  } catch (error) { return handleError(error, "english_resource_patch_failed", "No se pudo actualizar el material."); }
}

/** Elimina el material y su archivo. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/admin/ingles/recursos/[id]">) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  try { await deleteResource((await params).id); return ok(); }
  catch (error) { return handleError(error, "english_resource_delete_failed", "No se pudo eliminar el material."); }
}
