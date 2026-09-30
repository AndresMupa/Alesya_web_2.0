import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_NAME, uploadContentType, uploadsDirectory } from "@/lib/storage";

/** Sirve las fotos subidas desde el panel. Los nombres son UUID: el contenido nunca cambia. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!UPLOAD_NAME.test(file)) return new Response("No encontrado", { status: 404 });
  try {
    const body = await readFile(path.join(uploadsDirectory(), file));
    return new Response(body, { headers: { "content-type": uploadContentType[file.split(".").pop()!], "cache-control": "public, max-age=31536000, immutable", "content-security-policy": "default-src 'none'" } });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
