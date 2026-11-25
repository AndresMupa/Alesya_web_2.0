import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { englishAccessCodes } from "@/db/schema";
import { DomainError } from "@/lib/http";
import { CODE_ALPHABET, GRADES, isGrade, normalizeCode, type AccessMode, type Grade } from "@/lib/english/levels";

/**
 * Acceso al material del Área de Inglés. Quien canjea un código recibe una cookie firmada con la lista de códigos
 * canjeados (no los grados): en cada visita se vuelven a leer de la base, así que desactivar o vencer un código
 * corta el acceso de inmediato, sin cuentas de usuario ni contraseñas.
 */
export const ENGLISH_COOKIE = "alesya_ingles";
const COOKIE_DAYS = 365;
const MAX_CODES_PER_DEVICE = 10;

function signingKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  // Clave propia derivada del secreto del panel: una cookie del Área de Inglés nunca sirve como sesión administrativa.
  return createHmac("sha256", secret).update("alesya-ingles-acceso-v1").digest();
}

export const englishAccessConfigured = () => signingKey() !== null;

const sign = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url");

function readCookieIds(token: string | undefined): string[] {
  const key = signingKey();
  if (!key || !token || token.length > 2048) return [];
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return [];
  const expected = Buffer.from(sign(key, payload)), actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return [];
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { c?: unknown; exp?: unknown };
    if (typeof data.exp !== "number" || data.exp <= Date.now() / 1000 || !Array.isArray(data.c)) return [];
    return data.c.filter((id): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id)).slice(0, MAX_CODES_PER_DEVICE);
  } catch { return []; }
}

/** Valor de la cookie para una lista de códigos canjeados. */
export function accessCookieValue(codeIds: string[]) {
  const key = signingKey();
  if (!key) throw new DomainError("El acceso con código no está configurado en el servidor.", 503);
  const payload = Buffer.from(JSON.stringify({ c: codeIds.slice(-MAX_CODES_PER_DEVICE), exp: Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86_400 })).toString("base64url");
  return `${payload}.${sign(key, payload)}`;
}

export const accessCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: COOKIE_DAYS * 86_400 };

export const parseGrades = (value: string): Grade[] => value === "all" ? [...GRADES] : [...new Set(value.split(",").map(Number).filter(isGrade))].sort();
export const serializeGrades = (grades: Grade[]) => grades.length === GRADES.length ? "all" : [...new Set(grades)].sort().join(",");

export type EnglishAccess = { grades: Set<Grade>; codeIds: string[]; expiresAt: Date | null };

/** Grados desbloqueados en este navegador, según los códigos de la cookie que siguen activos y vigentes. */
export async function getEnglishAccess(): Promise<EnglishAccess> {
  const ids = readCookieIds((await cookies()).get(ENGLISH_COOKIE)?.value);
  const empty: EnglishAccess = { grades: new Set(), codeIds: [], expiresAt: null };
  if (!ids.length) return empty;
  const now = new Date();
  const rows = await getDb().select({ id: englishAccessCodes.id, grades: englishAccessCodes.grades, expiresAt: englishAccessCodes.expiresAt }).from(englishAccessCodes)
    .where(and(inArray(englishAccessCodes.id, ids), eq(englishAccessCodes.active, true), or(isNull(englishAccessCodes.expiresAt), gt(englishAccessCodes.expiresAt, now))));
  if (!rows.length) return empty;
  const grades = new Set(rows.flatMap((row) => parseGrades(row.grades)));
  // Si algún código no vence, el acceso no tiene fecha de fin; si todos vencen, se muestra el más lejano.
  const expiresAt = rows.some((row) => !row.expiresAt) ? null : new Date(Math.max(...rows.map((row) => row.expiresAt!.getTime())));
  return { grades, codeIds: rows.map((row) => row.id), expiresAt };
}

/**
 * Única regla de acceso al material completo de un grado, usada por las páginas y por la entrega de archivos.
 * En versión de muestra todo está abierto; con "requiere activación" hace falta un código vigente para ese grado.
 */
export const gradeUnlocked = (grade: Grade, accessMode: AccessMode, access: EnglishAccess | null) =>
  accessMode === "sample" || Boolean(access?.grades.has(grade));

/** IDs crudos de la cookie (incluye códigos ya desactivados), para sumar uno nuevo sin perder los anteriores. */
export async function cookieCodeIds() {
  return readCookieIds((await cookies()).get(ENGLISH_COOKIE)?.value);
}

/**
 * Canjea un código: valida que exista, esté activo, no haya vencido y tenga usos disponibles, y suma un uso.
 * Los mensajes distinguen el motivo porque quien lo escribe ya tiene el código en la mano.
 */
export async function redeemCode(input: string) {
  const code = normalizeCode(input);
  if (code.length < 6 || code.length > 24) throw new DomainError("Revisa el código: debe tener entre 6 y 24 letras y números.", 400);
  const db = getDb();
  const [row] = await db.select().from(englishAccessCodes).where(eq(englishAccessCodes.code, code)).limit(1);
  if (!row || !row.active) throw new DomainError("Ese código no es válido. Revísalo letra por letra o pide uno nuevo a tu colegio.", 404);
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) throw new DomainError("Ese código ya venció. Pide uno nuevo a tu colegio o escríbenos.", 410);
  const now = new Date();
  const updated = await db.update(englishAccessCodes).set({ uses: sql`${englishAccessCodes.uses} + 1`, lastUsedAt: now })
    .where(and(eq(englishAccessCodes.id, row.id), or(isNull(englishAccessCodes.maxUses), lt(englishAccessCodes.uses, englishAccessCodes.maxUses))));
  if (!updated.rowsAffected) throw new DomainError("Ese código ya se usó el número de veces permitido. Pide uno nuevo a tu colegio o escríbenos.", 409);
  return { id: row.id, label: row.label, grades: parseGrades(row.grades) };
}

/** Código aleatorio de 12 caracteres legibles (≈ 10^17 combinaciones; el canje tiene límite de intentos). */
export function generateCode(length = 12) {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export type CodeBatchInput = { label: string; grades: Grade[]; count: number; maxUses: number | null; expiresAt: Date | null; customCode?: string };

/**
 * Crea uno o varios códigos con las mismas condiciones (p. ej. 40 códigos de un uso para un curso, o un solo código
 * con nombre propio impreso en todos los libros de un grado). Devuelve los códigos creados.
 */
export async function createCodes(input: CodeBatchInput) {
  if (!input.grades.length) throw new DomainError("Elige al menos un grado.", 400);
  const db = getDb(), now = new Date(), grades = serializeGrades(input.grades);
  const custom = input.customCode ? normalizeCode(input.customCode) : "";
  if (custom) {
    if (custom.length < 6 || custom.length > 24) throw new DomainError("El código propio debe tener entre 6 y 24 letras y números.", 400);
    const [taken] = await db.select({ id: englishAccessCodes.id }).from(englishAccessCodes).where(eq(englishAccessCodes.code, custom)).limit(1);
    if (taken) throw new DomainError("Ese código ya existe. Elige otro.", 409);
  }
  const codes = new Set<string>(custom ? [custom] : []);
  while (codes.size < (custom ? 1 : input.count)) codes.add(generateCode());
  const rows = [...codes].map((code) => ({ id: crypto.randomUUID(), code, label: input.label, grades, maxUses: input.maxUses, expiresAt: input.expiresAt, createdAt: now }));
  for (let i = 0; i < rows.length; i += 100) await db.insert(englishAccessCodes).values(rows.slice(i, i + 100));
  return rows.map(({ id, code }) => ({ id, code }));
}

export async function setCodeActive(id: string, active: boolean) {
  const result = await getDb().update(englishAccessCodes).set({ active }).where(eq(englishAccessCodes.id, id));
  if (!result.rowsAffected) throw new DomainError("El código ya no existe.", 404);
}
