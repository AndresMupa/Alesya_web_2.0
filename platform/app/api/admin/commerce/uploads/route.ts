import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authorizeAdmin } from "@/lib/admin-auth";
import { fail, handleError, ok } from "@/lib/http";
import { uploadsAvailable, uploadsDirectory } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

/** Reconoce el formato por su firma binaria, no por el nombre ni el tipo que declara el navegador. */
function imageExtension(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Sube una foto de producto a la carpeta privada de datos y devuelve su URL pública `/uploads/<archivo>`. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  if (!uploadsAvailable()) return fail("La subida de imágenes no está disponible en este alojamiento.", 503);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Adjunta una imagen.");
  if (file.size > MAX_BYTES) return fail("La imagen supera 5 MB. Redúcela e intenta de nuevo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = imageExtension(bytes);
  if (!extension) return fail("Formato no admitido. Usa JPG, PNG o WebP.");
  const name = `${crypto.randomUUID()}.${extension}`;
  try {
    const directory = uploadsDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(directory, name), bytes, { mode: 0o600, flag: "wx" });
    return ok({ ok: true, url: `/uploads/${name}` }, 201);
  } catch (error) { return handleError(error, "admin_upload_failed", "No se pudo guardar la imagen."); }
}
