import "server-only";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/http";
import { UPLOAD_NAME, uploadsAvailable, uploadsDirectory } from "@/lib/storage";

// Todas las rutas de archivo de este módulo llevan `/* turbopackIgnore: true */`. Sin el comentario, el rastreo de
// archivos de Next no puede saber qué se leerá o escribirá en tiempo de ejecución y mete el proyecto entero (código
// fuente, scripts, .env.example) en el paquete standalone, que el empaquetado de cPanel rechaza. Ninguna de estas
// carpetas hace falta en el rastreo: los subidos viven fuera de la app y `public/` se copia aparte (prepare-standalone.mjs).

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
  const content = detected.extension === "jpg" || detected.extension === "png" || detected.extension === "webp" ? await optimizeImage(bytes, detected.extension) : bytes;
  const directory = uploadsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(/* turbopackIgnore: true */ directory, name), content, { mode: 0o600, flag: "wx" });
  return { url: `/uploads/${name}`, kind: detected.kind };
}

const MAX_SIDE = 2000;

/**
 * Prepara una foto subida para la web: la endereza según la orientación de la cámara, la reduce a 2000 px por lado
 * como máximo y la recomprime sin metadatos (una foto de celular trae la ubicación GPS en el EXIF). Si sharp no está
 * disponible o la imagen no se puede procesar, se guarda el archivo original: subir nunca falla por esto.
 */
async function optimizeImage(bytes: Uint8Array, extension: "jpg" | "png" | "webp"): Promise<Uint8Array> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(bytes).metadata();
    if ((meta.pages ?? 1) > 1) return bytes; // animaciones: se dejan tal cual
    let image = sharp(bytes).rotate();
    if ((meta.width ?? 0) > MAX_SIDE || (meta.height ?? 0) > MAX_SIDE) image = image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    const output = extension === "jpg" ? await image.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer()
      : extension === "png" ? await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
      : await image.webp({ quality: 80 }).toBuffer();
    // Con metadatos (posible GPS) siempre se usa la versión limpia; sin ellos, solo si quedó más liviana.
    return meta.exif || meta.xmp || output.length < bytes.length ? new Uint8Array(output) : bytes;
  } catch (error) {
    console.warn("upload_optimize_skipped", error instanceof Error ? error.message : error);
    return bytes;
  }
}

export type MediaItem = { url: string; name: string; kind: MediaKind; size: number; source: "uploads" | "media" };

/** Biblioteca de medios: lo subido desde el panel (más reciente primero) y los archivos de `public/media` incluidos en el despliegue. */
export async function listMediaLibrary(kind?: MediaKind): Promise<MediaItem[]> {
  const uploads: (MediaItem & { modifiedAt: number })[] = [];
  const directory = uploadsDirectory();
  for (const entry of await readdir(/* turbopackIgnore: true */ directory).catch(() => [] as string[])) {
    if (!UPLOAD_NAME.test(entry)) continue;
    const info = await stat(path.join(/* turbopackIgnore: true */ directory, entry)).catch(() => null);
    if (!info) continue;
    uploads.push({ url: `/uploads/${entry}`, name: entry, kind: kindByExtension[entry.split(".").pop()!], size: info.size, source: "uploads", modifiedAt: info.mtimeMs });
  }
  const bundled: MediaItem[] = [];
  await walk(path.join(/* turbopackIgnore: true */ process.cwd(), "public", "media"), "", bundled);
  const items = [...uploads.sort((a, b) => b.modifiedAt - a.modifiedAt).map(({ url, name, kind, size, source }) => ({ url, name, kind, size, source })), ...bundled.sort((a, b) => a.name.localeCompare(b.name))];
  return kind ? items.filter((item) => item.kind === kind) : items;
}

async function walk(root: string, relative: string, into: MediaItem[], depth = 0) {
  if (depth > 3) return;
  const entries = await readdir(path.join(/* turbopackIgnore: true */ root, relative), { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { await walk(root, name, into, depth + 1); continue; }
    const kind = kindByExtension[entry.name.split(".").pop()!.toLowerCase()];
    if (!kind) continue;
    const info = await stat(path.join(/* turbopackIgnore: true */ root, name)).catch(() => null);
    if (info) into.push({ url: `/media/${name}`, name, kind, size: info.size, source: "media" });
  }
}
