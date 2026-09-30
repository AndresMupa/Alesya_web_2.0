import { eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { leadStages } from "@/lib/statuses";

const schema = z.object({ id: z.string().uuid(), stage: z.enum(leadStages.map((stage) => stage.value) as [string, ...string[]]).optional(), owner: z.string().trim().max(120).optional() }).refine((value) => value.stage !== undefined || value.owner !== undefined);

export async function PATCH(request: Request) {
  const denied = await guardAdmin(request); if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa la etapa o el responsable." }, { status: 400 });
  const { id, stage, owner } = parsed.data;
  try {
    const result = await getDb().update(leads).set({ ...(stage && { stage }), ...(owner !== undefined && { owner: owner || null }), updatedAt: new Date() }).where(eq(leads.id, id));
    if (!result.rowsAffected) return Response.json({ message: "La oportunidad no existe." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { console.error("admin_lead_update_failed", error); return Response.json({ message: "No se pudo actualizar la oportunidad." }, { status: 503 }); }
}
