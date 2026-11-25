import { BookOpen, Headphones, PenLine, PlayCircle, type LucideIcon } from "lucide-react";

/**
 * Área de Inglés: niveles (grados 1° a 5° de primaria) y tipos de material. Seguro para cliente y servidor.
 * El texto de cada grado se puede reescribir desde /admin/ingles; aquí están los valores por defecto.
 */
export const GRADES = [1, 2, 3, 4, 5] as const;
export type Grade = (typeof GRADES)[number];

export type LevelTone = "lime" | "cyan" | "yellow" | "coral" | "violet";

export type Level = {
  grade: Grade;
  slug: `grado-${Grade}`;
  name: string;
  ordinal: string;
  tone: LevelTone;
  tagline: string;
  description: string;
};

const defaults: Record<Grade, Omit<Level, "grade" | "slug">> = {
  1: { name: "Primero", ordinal: "1°", tone: "lime", tagline: "Hello, world!", description: "Primeras palabras en inglés: saludos, colores, números y el salón de clase, con canciones y juegos para escuchar y repetir." },
  2: { name: "Segundo", ordinal: "2°", tone: "cyan", tagline: "My world, my words", description: "La familia, los animales, la comida y la casa. Frases cortas para describir lo que ven y lo que les gusta." },
  3: { name: "Tercero", ordinal: "3°", tone: "yellow", tagline: "Let's talk!", description: "Rutinas, la hora, los lugares de la ciudad y las profesiones. Preguntas y respuestas para conversar en clase." },
  4: { name: "Cuarto", ordinal: "4°", tone: "coral", tagline: "Stories around me", description: "Lectura de historias cortas, el pasado simple y descripciones de personas y lugares. Más escritura propia." },
  5: { name: "Quinto", ordinal: "5°", tone: "violet", tagline: "Ready for more", description: "Proyectos en inglés, opiniones y planes futuros. Lectura, escucha y escritura para cerrar la primaria con confianza." },
};

export const isGrade = (value: unknown): value is Grade => GRADES.includes(value as Grade);

/** Nivel con los textos guardados en el panel encima de los de por defecto. */
export function levelOf(grade: Grade, stored?: { tagline?: string | null; description?: string | null }): Level {
  const base = defaults[grade];
  return { grade, slug: `grado-${grade}`, ...base, tagline: stored?.tagline?.trim() || base.tagline, description: stored?.description?.trim() || base.description };
}

export const defaultLevel = (grade: Grade) => defaults[grade];

/** `grado-3` → 3. Cualquier otra cosa → null. */
export function gradeFromSlug(slug: string): Grade | null {
  const match = /^grado-([1-5])$/.exec(slug);
  return match ? (Number(match[1]) as Grade) : null;
}

export const RESOURCE_TYPES = ["book", "audio", "video", "activity"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const resourceTypes: Record<ResourceType, { label: string; plural: string; icon: LucideIcon; action: string; hint: string }> = {
  book: { label: "Libro digital", plural: "Libros", icon: BookOpen, action: "Leer", hint: "El libro del estudiante para leer en pantalla." },
  audio: { label: "Audio", plural: "Audios", icon: Headphones, action: "Escuchar", hint: "Pistas de listening de cada unidad." },
  video: { label: "Video", plural: "Videos", icon: PlayCircle, action: "Ver", hint: "Canciones, historias y explicaciones en video." },
  activity: { label: "Actividad", plural: "Actividades", icon: PenLine, action: "Abrir", hint: "Fichas, guías y material para imprimir." },
};

/** Formatos que el panel deja elegir para cada tipo y tamaño máximo. El servidor vuelve a validar por contenido. */
export const uploadRules: Record<ResourceType, { accept: string; maxMb: number; formats: string }> = {
  book: { accept: ".pdf,application/pdf", maxMb: 80, formats: "PDF" },
  audio: { accept: ".mp3,.m4a,.ogg,.wav,audio/*", maxMb: 40, formats: "MP3, M4A, OGG o WAV" },
  video: { accept: ".mp4,.webm,video/mp4,video/webm", maxMb: 120, formats: "MP4 o WebM" },
  activity: { accept: ".pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.mp3,.m4a", maxMb: 40, formats: "PDF, imagen, Word, PowerPoint, Excel o audio" },
};

/** Lo que el público ve de un material. Nunca incluye el nombre del archivo en disco. */
export type PublicResource = {
  id: string; type: ResourceType; title: string; description: string; unit: string; free: boolean;
  format: string; size: number | null; embed: string | null; hasFile: boolean;
};

export const isResourceType = (value: unknown): value is ResourceType => RESOURCE_TYPES.includes(value as ResourceType);

/** Unidades sugeridas: el material del sitio anterior estaba organizado en Unit 1 a Unit 4 por grado. */
export const SUGGESTED_UNITS = ["Unit 1", "Unit 2", "Unit 3", "Unit 4"];

/** Códigos legibles: sin 0/O ni 1/I/L para que no se confundan al copiarlos del libro. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Normaliza lo que escribe el usuario: mayúsculas, sin espacios ni guiones. */
export const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** `ABCD2345EFGH` → `ABCD-2345-EFGH`. */
export const formatCode = (value: string) => normalizeCode(value).replace(/(.{4})(?=.)/g, "$1-");

/** Enlace de YouTube o Vimeo → URL para incrustar (sin cookies de seguimiento en YouTube). Null si no se reconoce. */
export function embedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = parsed.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = parsed.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(parsed.pathname)?.[1] ?? null;
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const vimeo = /(\d{6,12})/.exec(parsed.pathname)?.[1];
      if (vimeo) return `https://player.vimeo.com/video/${vimeo}?dnt=1`;
    }
    return null;
  } catch { return null; }
}

/** 23 456 789 bytes → "22,4 MB". */
export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
