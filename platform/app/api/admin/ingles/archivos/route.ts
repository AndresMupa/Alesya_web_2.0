import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { englishResources } from "@/db/schema";
import { authorizeAdmin } from "@/lib/admin-auth";
import { ENGLISH_FILE_NAME, removeEnglishFile, storeEnglishFile } from "@/lib/english/files";
import { isResourceType } from "@/lib/english/levels";
import { fail, handleError, ok } from "@/lib/http";

/** Sube el archivo de un material (PDF, audio, video o actividad) a la carpeta privada. Devuelve su nombre interno. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file"), type = form?.get("type");
  if (!(file instanceof File)) return fail("Adjunta el archivo del material.");
  if (!isResourceType(type)) return fail("Tipo de material no válido.");
  try {
    const stored = await storeEnglishFile(file, type);
    return ok({ ok: true, fileName: stored.fileName, fileSize: stored.fileSize, format: stored.extension.toUpperCase() }, 201);
  } catch (error) { return handleError(error, "english_file_upload_failed", "No se pudo guardar el archivo."); }
}

/** Descarta un archivo subido que no se llegó a guardar en ningún material (al cancelar la ficha). */
export async function DELETE(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const name = new URL(request.url).searchParams.get("archivo") ?? "";
  if (!ENGLISH_FILE_NAME.test(name)) return fail("Archivo no válido.");
  try {
    const [used] = await getDb().select({ id: englishResources.id }).from(englishResources).where(eq(englishResources.fileName, name)).limit(1);
    if (!used) await removeEnglishFile(name);
    return ok();
  } catch (error) { return handleError(error, "english_file_discard_failed", "No se pudo descartar el archivo."); }
}
