import { getAdmin } from "@/lib/admin-auth";
import { getEnglishAccess } from "@/lib/english/access";
import { englishContentType, englishFilePath, ENGLISH_FILE_NAME, extensionOf, type EnglishExtension } from "@/lib/english/files";
import { findResource } from "@/lib/english/resources";
import { fileResponse } from "@/lib/file-response";

const deny = (status: number, message: string) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });

/** Nombre de descarga legible a partir del título (`Unit 1 - Student's book.pdf`), seguro para la cabecera. */
function disposition(kind: "inline" | "attachment", title: string, extension: string) {
  const base = title.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "material";
  const ascii = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "'") || "material";
  return `${kind}; filename="${ascii}.${extension}"; filename*=UTF-8''${encodeURIComponent(`${base}.${extension}`)}`;
}

/**
 * Entrega el material del Área de Inglés. Solo con un código vigente para el grado (o si el material es de
 * muestra gratuita); el equipo con sesión del panel puede ver también los borradores. `?descargar=1` lo baja.
 */
async function serve(request: Request, { params }: RouteContext<"/ingles/archivo/[id]">) {
  const { id } = await params;
  const resource = await findResource(id).catch(() => null);
  if (!resource?.fileName || !ENGLISH_FILE_NAME.test(resource.fileName)) return deny(404, "Material no encontrado.");
  const admin = await getAdmin();
  if (!admin) {
    if (resource.status !== "published") return deny(404, "Material no encontrado.");
    if (!resource.free) {
      const access = await getEnglishAccess().catch(() => null);
      if (!access?.grades.has(resource.grade as 1 | 2 | 3 | 4 | 5)) return deny(403, "Este material se abre con el código de tu libro. Ingrésalo en alesyaediciones.com/ingles.");
    }
  }
  const extension = extensionOf(resource.fileName) as EnglishExtension;
  const download = new URL(request.url).searchParams.get("descargar") === "1";
  const headers: Record<string, string> = {
    "content-type": englishContentType[extension],
    // Privado: solo el navegador de quien tiene el código lo guarda, una hora (los audios se piden por partes).
    "cache-control": "private, max-age=3600",
    "content-disposition": disposition(download ? "attachment" : "inline", resource.title, extension),
    "x-robots-tag": "noindex, nofollow",
  };
  // El visor de PDF del navegador necesita poder mostrarse dentro del lector del sitio; el resto no ejecuta nada.
  if (extension !== "pdf") headers["content-security-policy"] = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";
  const response = await fileResponse(request, englishFilePath(resource.fileName), headers);
  return response ?? deny(404, "El archivo de este material no está disponible.");
}

export const GET = serve;
export const HEAD = serve;
