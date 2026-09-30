import "server-only";
import os from "node:os";
import path from "node:path";

/**
 * Carpeta privada de datos: la misma que usa SQLite (ver db/index.ts). En cPanel vive fuera de la
 * raíz de la app, así que los despliegues (que reemplazan la carpeta de la app) no borran lo subido.
 */
export function dataDirectory() {
  if (process.env.ALESYA_DATA_DIR) return path.resolve(process.env.ALESYA_DATA_DIR);
  if (process.env.NODE_ENV === "production") return path.join(os.homedir(), "alesya-data");
  return path.resolve(".local");
}

export const uploadsDirectory = () => path.join(dataDirectory(), "uploads");

/** En Vercel o con Turso remoto el disco no es persistente: no se aceptan archivos. */
export const uploadsAvailable = () => !process.env.VERCEL;

export const UPLOAD_NAME = /^[a-z0-9-]{8,80}\.(jpg|png|webp)$/;
export const uploadContentType: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
