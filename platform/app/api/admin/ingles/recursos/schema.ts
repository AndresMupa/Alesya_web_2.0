import { z } from "zod";
import { GRADES, RESOURCE_TYPES } from "@/lib/english/levels";

/** Datos de un material tal como los envía el formulario del panel. */
export const resourceSchema = z.object({
  grade: z.coerce.number().int().refine((value) => GRADES.includes(value as never), "Grado no válido").transform((value) => value as (typeof GRADES)[number]),
  type: z.enum(RESOURCE_TYPES),
  title: z.string().trim().min(2, "Escribe un título.").max(160),
  description: z.string().trim().max(600).default(""),
  unit: z.string().trim().max(60).default(""),
  free: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  fileName: z.string().regex(/^[a-f0-9-]{36}\.[a-z0-9]{2,4}$/).nullable().default(null),
  fileSize: z.number().int().nonnegative().nullable().default(null),
  externalUrl: z.string().trim().url().max(300).nullable().or(z.literal("").transform(() => null)).default(null),
});
