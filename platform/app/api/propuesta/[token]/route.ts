import { after } from "next/server";
import { z } from "zod";
import { getAdmin, sameOrigin } from "@/lib/admin-auth";
import { notifyProposalOpened, recordProposalRead } from "@/lib/crm/proposal";
import { PROPOSAL_SECTIONS, proposalSectionIds } from "@/lib/crm/proposal-plan";
import { PUBLIC_BODY_LIMIT, fail, handleError, ok, readBody } from "@/lib/http";
import { publicOrigin } from "@/lib/payments/wompi";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  /** Identificador aleatorio de la visita (vive en la pestaña del navegador): agrupa sus avances en una sola actividad. */
  visit: z.string().regex(/^[a-f0-9]{16,32}$/),
  sections: z.array(z.enum(proposalSectionIds)).max(PROPOSAL_SECTIONS.length).default([]),
  seconds: z.number().int().min(0).max(4 * 3600).default(0),
  arena: z.boolean().default(false),
});

/**
 * Analítica de lectura de la propuesta, sin terceros: qué secciones vio, cuánto tiempo y si jugó la Arena. No guarda
 * nada del visitante (ni IP, ni navegador, ni cookies). Las visitas con sesión del panel son vistas previas del asesor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(request)) return fail("Origen no permitido.", 403);
  const limited = await enforceRateLimit(request, { name: "proposal-read", limit: 90, globalLimit: 2000, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return fail("Propuesta no válida.", 404);
  const body = await readBody(request, schema, "Lectura no válida.", PUBLIC_BODY_LIMIT); if (body instanceof Response) return body;
  if (await getAdmin()) return ok({ tracked: false, preview: true });
  try {
    const result = await recordProposalRead(token, body.visit, { sections: [...new Set(body.sections)], seconds: body.seconds, arena: body.arena });
    if (!result) return fail("Propuesta no válida.", 404);
    const opened = result.first;
    if (opened) {
      const origin = publicOrigin(request);
      after(() => notifyProposalOpened(opened, origin).catch((error) => console.error("proposal_notify_failed", error)));
    }
    return ok({ tracked: result.tracked });
  } catch (error) { return handleError(error, "proposal_read_failed", "No se pudo registrar la lectura."); }
}
