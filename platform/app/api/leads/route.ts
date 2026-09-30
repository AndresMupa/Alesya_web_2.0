import { z } from "zod";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";

const leadSchema = z.object({ name: z.string().trim().min(2).max(120), organization: z.string().trim().min(2).max(160), email: z.string().email().max(180), phone: z.string().trim().max(30).optional().transform((value) => value || undefined), message: z.string().trim().min(8).max(2000) });
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "lead", limit: 5, globalLimit: 100, windowMs: 15 * 60_000 });
  if (limited) return limited;
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa los datos del formulario." }, { status: 400 });
  const now = new Date();
  try { await getDb().insert(leads).values({ id: crypto.randomUUID(), ...parsed.data, source: "website", stage: "new", createdAt: now, updatedAt: now }); return Response.json({ ok: true }, { status: 201 }); }
  catch (error) { console.error("lead_create_failed", error); return Response.json({ message: "El CRM no está disponible temporalmente." }, { status: 503 }); }
}
