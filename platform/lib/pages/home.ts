import "server-only";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { DomainError } from "@/lib/http";
import { defaultHomeDocument, homeDocumentSchema, type HomeDocument } from "@/lib/pages/home-schema";

const SLUG = "home";
const KEEP_REVISIONS = 30;

const serialize = (document: HomeDocument) => JSON.stringify(document);

/** Un documento guardado que ya no pase la validación (por ejemplo de una versión anterior del código) se ignora en vez de romper la portada. */
function parse(body: string | null | undefined): HomeDocument | null {
  if (!body) return null;
  try {
    const result = homeDocumentSchema.safeParse(JSON.parse(body));
    return result.success ? result.data : null;
  } catch { return null; }
}

async function getRow() {
  const [row] = await getDb().select().from(pages).where(eq(pages.slug, SLUG)).limit(1);
  return row ?? null;
}

/** Lo que ve el público: la versión publicada o, si nunca se ha publicado, el diseño original. */
export async function getPublishedHome(): Promise<HomeDocument> {
  const row = await getRow();
  return parse(row?.published) ?? defaultHomeDocument();
}

/** El borrador que edita el equipo (vista previa). */
export async function getDraftHome(): Promise<HomeDocument> {
  const row = await getRow();
  return parse(row?.draft) ?? parse(row?.published) ?? defaultHomeDocument();
}

export async function listHomeRevisions() {
  return getDb().select({ id: pageRevisions.id, createdAt: pageRevisions.createdAt, createdBy: pageRevisions.createdBy }).from(pageRevisions).where(eq(pageRevisions.slug, SLUG)).orderBy(desc(pageRevisions.createdAt)).limit(KEEP_REVISIONS);
}

/** Estado completo para el editor: borrador, publicado, si difieren y el historial de versiones. */
export async function getHomeState() {
  const row = await getRow();
  const published = parse(row?.published);
  const draft = parse(row?.draft) ?? published ?? defaultHomeDocument();
  const live = published ?? defaultHomeDocument();
  return { draft, published, dirty: serialize(draft) !== serialize(live), draftUpdatedAt: row?.draftUpdatedAt ?? null, publishedAt: row?.publishedAt ?? null, updatedBy: row?.updatedBy ?? null, revisions: await listHomeRevisions() };
}

export async function saveHomeDraft(document: HomeDocument, by: string) {
  const now = new Date();
  const body = serialize(document);
  await getDb().insert(pages).values({ slug: SLUG, draft: body, draftUpdatedAt: now, updatedBy: by }).onConflictDoUpdate({ target: pages.slug, set: { draft: body, draftUpdatedAt: now, updatedBy: by } });
  return now;
}

/** Publica el borrador tal cual está y guarda una versión en el historial. */
export async function publishHome(by: string) {
  const db = getDb();
  const row = await getRow();
  const document = parse(row?.draft) ?? parse(row?.published) ?? defaultHomeDocument();
  const body = serialize(document);
  const now = new Date();
  await db.batch([
    db.insert(pages).values({ slug: SLUG, draft: body, published: body, draftUpdatedAt: row?.draftUpdatedAt ?? now, publishedAt: now, updatedBy: by }).onConflictDoUpdate({ target: pages.slug, set: { draft: body, published: body, publishedAt: now, updatedBy: by } }),
    db.insert(pageRevisions).values({ id: crypto.randomUUID(), slug: SLUG, body, createdBy: by, createdAt: now }),
  ]);
  await pruneRevisions();
  return { document, publishedAt: now };
}

async function pruneRevisions() {
  const db = getDb();
  const keep = await db.select({ id: pageRevisions.id }).from(pageRevisions).where(eq(pageRevisions.slug, SLUG)).orderBy(desc(pageRevisions.createdAt)).limit(KEEP_REVISIONS);
  if (keep.length < KEEP_REVISIONS) return;
  await db.delete(pageRevisions).where(and(eq(pageRevisions.slug, SLUG), notInArray(pageRevisions.id, keep.map((revision) => revision.id))));
}

/** Descarta el borrador: vuelve a lo publicado (o al diseño original si nunca se publicó). */
export async function discardHomeDraft(by: string) {
  const row = await getRow();
  const document = parse(row?.published) ?? defaultHomeDocument();
  await saveHomeDraft(document, by);
  return document;
}

/** Carga el diseño original en el borrador (no toca lo publicado hasta que se publique). */
export async function resetHomeDraft(by: string) {
  const document = defaultHomeDocument();
  await saveHomeDraft(document, by);
  return document;
}

/** Carga una versión publicada antes en el borrador, para revisarla y volver a publicarla. */
export async function restoreHomeRevision(id: string, by: string) {
  const [revision] = await getDb().select().from(pageRevisions).where(and(eq(pageRevisions.id, id), eq(pageRevisions.slug, SLUG))).limit(1);
  const document = revision ? parse(revision.body) : null;
  if (!document) throw new DomainError("Esa versión ya no existe.", 404);
  await saveHomeDraft(document, by);
  return document;
}
