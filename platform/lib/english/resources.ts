import "server-only";
import { and, asc, count, desc, eq, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { englishAccessCodes, englishLevels, englishResources } from "@/db/schema";
import { DomainError } from "@/lib/http";
import { embedUrl, GRADES, levelOf, RESOURCE_TYPES, type Grade, type Level, type PublicResource, type ResourceType } from "@/lib/english/levels";

export type { PublicResource };
import { extensionOf, removeEnglishFile } from "@/lib/english/files";

type ResourceRow = typeof englishResources.$inferSelect;


const toPublic = (row: ResourceRow): PublicResource => ({
  id: row.id, type: row.type as ResourceType, title: row.title, description: row.description, unit: row.unit, free: row.free,
  format: extensionOf(row.fileName).toUpperCase(), size: row.fileSize, embed: row.externalUrl ? embedUrl(row.externalUrl) : null, hasFile: Boolean(row.fileName),
});

export type LevelSummary = Level & { counts: Record<ResourceType, number>; total: number };

const emptyCounts = () => Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])) as Record<ResourceType, number>;

/** Los cinco grados con su texto (guardado o por defecto) y cuánto material publicado tiene cada uno. */
export async function listLevels(): Promise<LevelSummary[]> {
  const db = getDb();
  const [stored, totals] = await Promise.all([
    db.select().from(englishLevels),
    db.select({ grade: englishResources.grade, type: englishResources.type, total: count() }).from(englishResources).where(eq(englishResources.status, "published")).groupBy(englishResources.grade, englishResources.type),
  ]);
  return GRADES.map((grade) => {
    const counts = emptyCounts();
    for (const row of totals) if (row.grade === grade && row.type in counts) counts[row.type as ResourceType] = row.total;
    return { ...levelOf(grade, stored.find((row) => row.grade === grade)), counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  });
}

export async function getLevel(grade: Grade): Promise<Level> {
  const [stored] = await getDb().select().from(englishLevels).where(eq(englishLevels.grade, grade)).limit(1);
  return levelOf(grade, stored);
}

/** Material publicado de un grado, en el orden del panel. */
export async function listPublishedResources(grade: Grade): Promise<PublicResource[]> {
  const rows = await getDb().select().from(englishResources)
    .where(and(eq(englishResources.grade, grade), eq(englishResources.status, "published")))
    .orderBy(asc(englishResources.position), asc(englishResources.createdAt));
  return rows.map(toPublic);
}

export async function findResource(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const [row] = await getDb().select().from(englishResources).where(eq(englishResources.id, id)).limit(1);
  return row ?? null;
}

// ── Panel ────────────────────────────────────────────────────────────────────

export type AdminResource = PublicResource & { grade: Grade; status: "draft" | "published"; externalUrl: string | null; fileName: string | null; position: number; updatedAt: Date };

export async function listAdminResources(grade: Grade): Promise<AdminResource[]> {
  const rows = await getDb().select().from(englishResources).where(eq(englishResources.grade, grade)).orderBy(asc(englishResources.position), asc(englishResources.createdAt));
  return rows.map((row) => ({ ...toPublic(row), grade: row.grade as Grade, status: row.status as "draft" | "published", externalUrl: row.externalUrl, fileName: row.fileName, position: row.position, updatedAt: row.updatedAt }));
}

export type ResourceInput = {
  grade: Grade; type: ResourceType; title: string; description: string; unit: string; free: boolean; status: "draft" | "published";
  fileName: string | null; fileSize: number | null; externalUrl: string | null;
};

function validate(input: ResourceInput) {
  if (!input.fileName && !input.externalUrl) throw new DomainError(input.type === "video" ? "Sube el video o pega un enlace de YouTube o Vimeo." : "Sube el archivo del material.", 400);
  if (input.externalUrl && !embedUrl(input.externalUrl)) throw new DomainError("El enlace debe ser de YouTube o Vimeo.", 400);
  if (input.externalUrl && input.type !== "video") throw new DomainError("Solo los videos pueden usar un enlace externo.", 400);
}

export async function createResource(input: ResourceInput) {
  validate(input);
  const db = getDb();
  const [{ last }] = await db.select({ last: max(englishResources.position) }).from(englishResources).where(eq(englishResources.grade, input.grade));
  const now = new Date(), id = crypto.randomUUID();
  await db.insert(englishResources).values({ id, ...input, position: (last ?? 0) + 1, createdAt: now, updatedAt: now });
  return id;
}

export async function updateResource(id: string, input: ResourceInput) {
  const current = await findResource(id);
  if (!current) throw new DomainError("El material ya no existe.", 404);
  validate(input);
  const now = new Date();
  // Cambiar de grado lo manda al final de la lista del grado nuevo.
  let position = current.position;
  if (current.grade !== input.grade) {
    const [{ last }] = await getDb().select({ last: max(englishResources.position) }).from(englishResources).where(eq(englishResources.grade, input.grade));
    position = (last ?? 0) + 1;
  }
  await getDb().update(englishResources).set({ ...input, position, updatedAt: now }).where(eq(englishResources.id, id));
  if (current.fileName && current.fileName !== input.fileName) await removeEnglishFile(current.fileName);
}

export async function setResourceStatus(id: string, status: "draft" | "published") {
  const result = await getDb().update(englishResources).set({ status, updatedAt: new Date() }).where(eq(englishResources.id, id));
  if (!result.rowsAffected) throw new DomainError("El material ya no existe.", 404);
}

export async function deleteResource(id: string) {
  const current = await findResource(id);
  if (!current) throw new DomainError("El material ya no existe.", 404);
  await getDb().delete(englishResources).where(eq(englishResources.id, id));
  await removeEnglishFile(current.fileName);
}

/** Sube o baja un material un puesto dentro de su grado (intercambia la posición con el vecino). */
export async function moveResource(id: string, direction: "up" | "down") {
  const current = await findResource(id);
  if (!current) throw new DomainError("El material ya no existe.", 404);
  const siblings = await getDb().select({ id: englishResources.id, position: englishResources.position }).from(englishResources)
    .where(eq(englishResources.grade, current.grade)).orderBy(asc(englishResources.position), asc(englishResources.createdAt));
  const index = siblings.findIndex((row) => row.id === id), target = siblings[direction === "up" ? index - 1 : index + 1];
  if (!target) return;
  // Renumera todo el grado para que no queden posiciones repetidas de materiales antiguos.
  const order = siblings.map((row) => row.id);
  [order[index], order[direction === "up" ? index - 1 : index + 1]] = [order[direction === "up" ? index - 1 : index + 1], order[index]];
  const db = getDb();
  const [first, ...rest] = order.map((rowId, position) => db.update(englishResources).set({ position: position + 1 }).where(eq(englishResources.id, rowId)));
  await db.batch([first, ...rest]);
}

export async function saveLevel(grade: Grade, tagline: string, description: string) {
  const now = new Date();
  await getDb().insert(englishLevels).values({ grade, tagline, description, updatedAt: now })
    .onConflictDoUpdate({ target: englishLevels.grade, set: { tagline, description, updatedAt: now } });
}

/** Números para la cabecera del panel. */
export async function englishStats() {
  const db = getDb();
  const [resources, codes] = await Promise.all([
    db.select({ status: englishResources.status, total: count() }).from(englishResources).groupBy(englishResources.status),
    db.select({ active: englishAccessCodes.active, total: count(), uses: sql<number>`coalesce(sum(${englishAccessCodes.uses}), 0)` }).from(englishAccessCodes).groupBy(englishAccessCodes.active),
  ]);
  const byStatus = Object.fromEntries(resources.map((row) => [row.status, row.total]));
  return {
    published: byStatus.published ?? 0, drafts: byStatus.draft ?? 0,
    activeCodes: codes.find((row) => row.active)?.total ?? 0,
    redemptions: codes.reduce((sum, row) => sum + Number(row.uses), 0),
  };
}

// ── Códigos ──────────────────────────────────────────────────────────────────

export type AdminCode = { id: string; code: string; label: string; grades: string; maxUses: number | null; uses: number; expiresAt: Date | null; active: boolean; lastUsedAt: Date | null; createdAt: Date };

export async function listCodes(limit = 500): Promise<AdminCode[]> {
  return getDb().select().from(englishAccessCodes).orderBy(desc(englishAccessCodes.createdAt), asc(englishAccessCodes.label)).limit(limit);
}
