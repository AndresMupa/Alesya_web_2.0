import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { fail, handleError, noStore, ok, readBody } from "@/lib/http";
import { discardHomeDraft, getHomeState, publishHome, resetHomeDraft, restoreHomeRevision, saveHomeDraft } from "@/lib/pages/home";
import { blockCatalog, homeDocumentSchema } from "@/lib/pages/home-schema";

const draftSchema = z.object({ document: homeDocumentSchema });
const actionSchema = z.object({ action: z.enum(["publish", "discard", "reset", "restore"]), revisionId: z.string().uuid().optional() });

/** Ruta del error ["document","sections",2,"slides",0,"primaryHref"] → "Portada principal · slides · elemento 1 · primaryHref: Enlace no válido". */
function describeIssue(issue: z.ZodIssue, document: unknown) {
  const [root, list, index, ...rest] = issue.path;
  if (root !== "document" || list !== "sections" || typeof index !== "number") return `${issue.path.slice(1).join(" · ") || "documento"}: ${issue.message}`;
  const sections = (document as { sections?: { type?: keyof typeof blockCatalog }[] } | null)?.sections;
  const type = sections?.[index]?.type;
  const where = type && blockCatalog[type] ? blockCatalog[type].label : `sección ${index + 1}`;
  const field = rest.map((part) => (typeof part === "number" ? `elemento ${part + 1}` : part)).join(" · ");
  return `${where}${field ? ` · ${field}` : ""}: ${issue.message}`;
}

/** Estado del editor: borrador, versión publicada, si difieren y el historial. */
export async function GET() {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  try { return Response.json(await getHomeState(), { headers: noStore }); }
  catch (error) { return handleError(error, "home_state_failed", "No se pudo leer la portada."); }
}

/** Guarda el borrador (autoguardado del editor). No cambia lo que ve el público. */
export async function PUT(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const raw = await request.json().catch(() => null) as { document?: unknown } | null;
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return fail(`Revisa el contenido: ${describeIssue(parsed.error.issues[0], raw?.document)}`);
  try {
    await saveHomeDraft(parsed.data.document, admin.email);
    const state = await getHomeState();
    return ok({ ok: true, draftUpdatedAt: state.draftUpdatedAt, dirty: state.dirty });
  } catch (error) { return handleError(error, "home_draft_failed", "No se pudo guardar el borrador."); }
}

/** Publicar el borrador, descartarlo, volver al diseño original o cargar una versión anterior. Devuelve el estado nuevo. */
export async function POST(request: Request) {
  const admin = await authorizeAdmin(request); if (admin instanceof Response) return admin;
  const body = await readBody(request, actionSchema); if (body instanceof Response) return body;
  try {
    if (body.action === "publish") await publishHome(admin.email);
    else if (body.action === "discard") await discardHomeDraft(admin.email);
    else if (body.action === "reset") await resetHomeDraft(admin.email);
    else if (!body.revisionId) return fail("Elige la versión que quieres cargar.");
    else await restoreHomeRevision(body.revisionId, admin.email);
    return ok({ ok: true, ...(await getHomeState()) });
  } catch (error) { return handleError(error, "home_action_failed", "No se pudo completar la acción."); }
}
