import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOAD_NAME, uploadContentType, uploadsDirectory } from "@/lib/storage";

const notFound = () => new Response("No encontrado", { status: 404 });

/**
 * Sirve las fotos y videos subidos desde el panel. Los nombres son UUID: el contenido nunca cambia.
 * Responde por rangos (`Range: bytes=…`): sin eso Safari no reproduce video y no se puede adelantar.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!UPLOAD_NAME.test(file)) return notFound();
  const filePath = path.join(uploadsDirectory(), file);
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return notFound();
  const headers: Record<string, string> = { "content-type": uploadContentType[file.split(".").pop()!], "cache-control": "public, max-age=31536000, immutable", "content-security-policy": "default-src 'none'", "accept-ranges": "bytes" };
  if (info.size === 0) return new Response(null, { status: 200, headers: { ...headers, "content-length": "0" } });

  let start = 0, end = info.size - 1, status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= info.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
  }
  headers["content-length"] = String(end - start + 1);
  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(body, { status, headers });
}
