import { authorizeAdmin } from "@/lib/admin-auth";
import { fail, handleError, ok } from "@/lib/http";
import { storeUpload } from "@/lib/media";

/** Sube una foto de producto a la carpeta privada de datos y devuelve su URL pública `/uploads/<archivo>`. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Adjunta una imagen.");
  try { return ok({ ok: true, ...(await storeUpload(file, ["image"])) }, 201); }
  catch (error) { return handleError(error, "admin_upload_failed", "No se pudo guardar la imagen."); }
}
