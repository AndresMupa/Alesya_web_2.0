import path from "node:path";
import { fileResponse } from "@/lib/file-response";
import { UPLOAD_NAME, uploadContentType, uploadsDirectory } from "@/lib/storage";

const notFound = () => new Response("No encontrado", { status: 404 });

/** Sirve las fotos y videos subidos desde el panel. Los nombres son UUID: el contenido nunca cambia. */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!UPLOAD_NAME.test(file)) return notFound();
  const response = await fileResponse(request, path.join(/* turbopackIgnore: true */ uploadsDirectory(), file), {
    "content-type": uploadContentType[file.split(".").pop()!], "cache-control": "public, max-age=31536000, immutable", "content-security-policy": "default-src 'none'",
  });
  return response ?? notFound();
}
