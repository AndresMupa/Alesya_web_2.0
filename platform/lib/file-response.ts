import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

/**
 * Respuesta con el contenido de un archivo del disco, por rangos (`Range: bytes=…`): sin eso Safari no reproduce
 * audio ni video y no se puede adelantar. `headers` lleva el tipo, la caché y lo que la ruta necesite.
 * Devuelve null si el archivo no existe.
 */
export async function fileResponse(request: Request, filePath: string, headers: Record<string, string>): Promise<Response | null> {
  const info = await stat(/* turbopackIgnore: true */ filePath).catch(() => null);
  if (!info?.isFile()) return null;
  const base: Record<string, string> = { ...headers, "accept-ranges": "bytes" };
  if (info.size === 0) return new Response(null, { status: 200, headers: { ...base, "content-length": "0" } });

  let start = 0, end = info.size - 1, status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= info.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    status = 206;
    base["content-range"] = `bytes ${start}-${end}/${info.size}`;
  }
  base["content-length"] = String(end - start + 1);
  if (request.method === "HEAD") return new Response(null, { status, headers: base });
  const body = Readable.toWeb(createReadStream(/* turbopackIgnore: true */ filePath, { start, end })) as ReadableStream;
  return new Response(body, { status, headers: base });
}
