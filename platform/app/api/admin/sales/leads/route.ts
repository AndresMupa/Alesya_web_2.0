import { and, count, desc, eq, inArray, like, lte, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { leads } from "@/db/schema";

const pageSize = 40;
const stages = ["new", "contacted", "meeting", "proposal", "won", "lost"];
const priorities = ["high", "medium", "low"];
const sources = ["base_colegios_2026", "website", "linkedin", "instagram", "facebook", "whatsapp", "manual"];

export async function GET(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const search = (params.get("search") ?? "").trim().slice(0, 100);
  const stage = params.get("stage") ?? "";
  const priority = params.get("priority") ?? "";
  const source = params.get("source") ?? "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const due = params.get("due") === "1";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const condition = and(
    search ? or(like(leads.organization, `%${search}%`), like(leads.name, `%${search}%`), like(leads.email, `%${search}%`), like(leads.city, `%${search}%`), like(leads.externalId, `%${search}%`)) : undefined,
    stages.includes(stage) ? eq(leads.stage, stage) : undefined,
    priorities.includes(priority) ? eq(leads.priority, priority) : undefined,
    sources.includes(source) ? like(leads.source, `${source}%`) : undefined,
    due ? and(lte(leads.nextFollowUp, today), not(inArray(leads.stage, ["won", "lost"]))) : undefined,
  );
  try {
    const db = getDb();
    const [rows, [totalRow], [allRow], [dueRow], [newRow]] = await Promise.all([
      db.select().from(leads).where(condition).orderBy(sql`case ${leads.priority} when 'high' then 0 when 'medium' then 1 else 2 end`, desc(leads.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(leads).where(condition),
      db.select({ value: count() }).from(leads),
      db.select({ value: count() }).from(leads).where(and(lte(leads.nextFollowUp, today), not(inArray(leads.stage, ["won", "lost"])))),
      db.select({ value: count() }).from(leads).where(eq(leads.stage, "new")),
    ]);
    return Response.json({ rows, page, pageSize, total: totalRow.value, metrics: { all: allRow.value, due: dueRow.value, new: newRow.value } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("sales_leads_failed", error);
    return Response.json({ message: "No se pudo cargar la base comercial." }, { status: 503 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  email: z.union([z.string().trim().email().max(180), z.literal("")]).default(""),
  phone: z.string().trim().max(30).default(""),
  city: z.string().trim().max(100).default(""),
  source: z.enum(["linkedin", "instagram", "facebook", "whatsapp", "website", "manual"]),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  message: z.string().trim().min(8).max(2000),
  notes: z.string().trim().max(4000).default(""),
});

export async function POST(request: Request) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisa los datos del nuevo contacto." }, { status: 400 });
  const { email, phone, city, ...values } = parsed.data;
  const now = new Date();
  try {
    await getDb().insert(leads).values({
      id: crypto.randomUUID(), ...values,
      email: email || null, phone: phone || null, city: city || null,
      stage: "new", createdAt: now, updatedAt: now,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("sales_lead_create_failed", error);
    return Response.json({ message: "No se pudo crear la oportunidad." }, { status: 503 });
  }
}
