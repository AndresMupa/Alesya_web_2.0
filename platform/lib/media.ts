import "server-only";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/http";
import { UPLOAD_NAME, uploadsAvailable, uploadsDirectory } from "@/lib/storage";

export type MediaKind = "image" | "video";
export const MEDIA_LIMITS: Record<MediaKind, number> = { image: 5 * 1024 * 1024, video: 60 * 1024 * 1024 };
const kindByExtension: Record<string, MediaKind> = { jpg: "image", jpeg: "image", png: "image", webp: "image", svg: "image", gif: "image", mp4: "video", webm: "video" };
const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** Reconoce el formato por su firma binaria, no por el nombre ni el tipo que declara el navegador. */
export function detectMedia(bytes: Uint8Array): { extension: "jpg" | "png" | "webp" | "mp4" | "webm"; kind: MediaKind } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", kind: "image" };
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return { extension: "png", kind: "image" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { extension: "webp", kind: "image" };
  if (ascii(4, 8) === "ftyp") return { extension: "mp4", kind: "video" };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { extension: "webm", kind: "video" };
  return null;
}

/**
 * Guarda una imagen o un video subido desde el panel en la carpeta privada de datos (sobrevive a los
 * despliegues) y devuelve su URL pública `/uploads/<uuid>.<ext>`. Lanza `DomainError` con el motivo.
 */
export async function storeUpload(file: File, kinds: MediaKind[] = ["image"]) {
  if (!uploadsAvailable()) throw new DomainError("La subida de archivos no está disponible en este alojamiento.", 503);
  const maxBytes = Math.max(...kinds.map((kind) => MEDIA_LIMITS[kind]));
  if (file.size > maxBytes) throw new DomainError(`El archivo supera ${megabytes(maxBytes)} MB. Redúcelo e intenta de nuevo.`, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectMedia(bytes);
  if (!detected || !kinds.includes(detected.kind)) throw new DomainError(kinds.includes("video") ? "Formato no admitido. Usa JPG, PNG, WebP, MP4 o WebM." : "Formato no admitido. Usa JPG, PNG o WebP.", 415);
  if (file.size > MEDIA_LIMITS[detected.kind]) throw new DomainError(`${detected.kind === "video" ? "El video" : "La imagen"} supera ${megabytes(MEDIA_LIMITS[detected.kind])} MB. Redúcelo e intenta de nuevo.`, 413);
  const name = `${crypto.randomUUID()}.${detected.extension}`;
  const directory = uploadsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, name), bytes, { mode: 0o600, flag: "wx" });
  return { url: `/uploads/${name}`, kind: detected.kind };
}

export type MediaItem = { url: string; name: string; kind: MediaKind; size: number; source: "uploads" | "media" };

/** Biblioteca de medios: lo subido desde el panel (más reciente primero) y los archivos de `public/media` incluidos en el despliegue. */
export async function listMediaLibrary(kind?: MediaKind): Promise<MediaItem[]> {
  const uploads: (MediaItem & { modifiedAt: number })[] = [];
  const directory = uploadsDirectory();
  for (const entry of await readdir(directory).catch(() => [] as string[])) {
    if (!UPLOAD_NAME.test(entry)) continue;
    const info = await stat(path.join(directory, entry)).catch(() => null);
    if (!info) continue;
    uploads.push({ url: `/uploads/${entry}`, name: entry, kind: kindByExtension[entry.split(".").pop()!], size: info.size, source: "uploads", modifiedAt: info.mtimeMs });
  }
  const bundled: MediaItem[] = [];
  await walk(path.join(process.cwd(), "public", "media"), "", bundled);
  const items = [...uploads.sort((a, b) => b.modifiedAt - a.modifiedAt).map(({ url, name, kind, size, source }) => ({ url, name, kind, size, source })), ...bundled.sort((a, b) => a.name.localeCompare(b.name))];
  return kind ? items.filter((item) => item.kind === kind) : items;
}

async function walk(root: string, relative: string, into: MediaItem[], depth = 0) {
  if (depth > 3) return;
  const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { await walk(root, name, into, depth + 1); continue; }
    const kind = kindByExtension[entry.name.split(".").pop()!.toLowerCase()];
    if (!kind) continue;
    const info = await stat(path.join(root, name)).catch(() => null);
    if (info) into.push({ url: `/media/${name}`, name, kind, size: info.size, source: "media" });
  }
}
