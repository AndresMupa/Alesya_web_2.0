import { authorizeAdmin } from "@/lib/admin-auth";
import { fail, handleError, noStore, ok } from "@/lib/http";
import { listMediaLibrary, storeUpload } from "@/lib/media";
import { uploadsAvailable } from "@/lib/storage";

/** Biblioteca de medios del panel: archivos subidos y los de `public/media`. `?kind=image|video` filtra. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const kind = new URL(request.url).searchParams.get("kind");
  try { return Response.json({ items: await listMediaLibrary(kind === "image" || kind === "video" ? kind : undefined), uploads: uploadsAvailable() }, { headers: noStore }); }
  catch (error) { return handleError(error, "media_list_failed", "No se pudo leer la biblioteca de medios."); }
}

/** Sube una imagen (hasta 5 MB) o un video MP4/WebM (hasta 60 MB) para la portada. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Adjunta una imagen o un video.");
  try { return ok({ ok: true, ...(await storeUpload(file, ["image", "video"])) }, 201); }
  catch (error) { return handleError(error, "media_upload_failed", "No se pudo guardar el archivo."); }
}
