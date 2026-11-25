import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/http";
import { dataDirectory, uploadsAvailable } from "@/lib/storage";
import { uploadRules, type ResourceType } from "@/lib/english/levels";

// Igual que en lib/media.ts: las rutas llevan `/* turbopackIgnore: true */` para que el rastreo de archivos de Next
// no meta el proyecto entero en el paquete standalone.

/**
 * Material del Área de Inglés. Vive en la carpeta privada de datos (no en /uploads, que es público): solo se
 * entrega por /ingles/archivo/<id>, que exige un código válido. Sobrevive a los despliegues como el resto de datos.
 */
export const englishDirectory = () => path.join(/* turbopackIgnore: true */ dataDirectory(), "ingles");

export type EnglishExtension = "pdf" | "mp3" | "m4a" | "ogg" | "wav" | "mp4" | "webm" | "jpg" | "png" | "webp" | "docx" | "pptx" | "xlsx";

export const ENGLISH_FILE_NAME = /^[a-f0-9-]{36}\.(pdf|mp3|m4a|ogg|wav|mp4|webm|jpg|png|webp|docx|pptx|xlsx)$/;

export const englishContentType: Record<EnglishExtension, string> = {
  pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm",
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Qué formatos admite cada tipo de material. Los límites de tamaño están en `uploadRules` (lib/english/levels.ts). */
const accepted: Record<ResourceType, { extensions: EnglishExtension[]; message: string }> = {
  book: { extensions: ["pdf"], message: "El libro debe ser un PDF." },
  audio: { extensions: ["mp3", "m4a", "ogg", "wav"], message: "El audio debe ser MP3, M4A, OGG o WAV." },
  video: { extensions: ["mp4", "webm"], message: "El video debe ser MP4 o WebM (o pega un enlace de YouTube)." },
  activity: { extensions: ["pdf", "jpg", "png", "webp", "docx", "pptx", "xlsx", "mp3", "m4a"], message: "La actividad debe ser PDF, imagen, Word, PowerPoint, Excel o audio." },
};

/**
 * Reconoce el formato por su firma binaria. Los formatos de Office son archivos ZIP: se distinguen por la extensión
 * del nombre original, pero solo si el contenido realmente es un ZIP.
 */
export function detectEnglishFile(bytes: Uint8Array, originalName: string): EnglishExtension | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  const extension = originalName.toLowerCase().split(".").pop() ?? "";
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && extension === "mp3")) return "mp3";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") return extension === "m4a" || ascii(8, 12) === "M4A " ? "m4a" : "mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "PK\u0003\u0004" && (extension === "docx" || extension === "pptx" || extension === "xlsx")) return extension;
  return null;
}

/** Guarda un archivo subido desde el panel para un tipo de material. Lanza `DomainError` con el motivo. */
export async function storeEnglishFile(file: File, type: ResourceType) {
  if (!uploadsAvailable()) throw new DomainError("La subida de archivos no está disponible en este alojamiento.", 503);
  const rule = accepted[type], { maxMb } = uploadRules[type];
  if (file.size > maxMb * 1024 * 1024) throw new DomainError(`El archivo supera ${maxMb} MB. Redúcelo e intenta de nuevo.`, 413);
  if (file.size === 0) throw new DomainError("El archivo está vacío.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectEnglishFile(bytes, file.name);
  if (!extension || !rule.extensions.includes(extension)) throw new DomainError(rule.message, 415);
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const directory = englishDirectory();
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(/* turbopackIgnore: true */ directory, fileName), bytes, { mode: 0o600, flag: "wx" });
  return { fileName, fileSize: file.size, extension };
}

export const englishFilePath = (fileName: string) => path.join(/* turbopackIgnore: true */ englishDirectory(), fileName);

/** Borra un archivo que ya nadie usa. Nunca falla: si no existe, no pasa nada. */
export async function removeEnglishFile(fileName: string | null | undefined) {
  if (!fileName || !ENGLISH_FILE_NAME.test(fileName)) return;
  await unlink(englishFilePath(fileName)).catch(() => undefined);
}

export const extensionOf = (fileName: string | null | undefined) => (fileName?.split(".").pop() ?? "") as EnglishExtension | "";
