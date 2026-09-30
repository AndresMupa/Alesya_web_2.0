import { desc } from "drizzle-orm";
import { guardAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { leads, orders, products } from "@/db/schema";
export async function GET() { const denied = await guardAdmin(); if (denied) return denied; try { const db=getDb(); const [leadRows,orderRows,productRows]=await Promise.all([db.select().from(leads).orderBy(desc(leads.createdAt)).limit(20),db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20),db.select().from(products).orderBy(desc(products.createdAt)).limit(50)]); return Response.json({leads:leadRows,orders:orderRows,products:productRows}, {headers:{"Cache-Control":"private, no-store"}}); } catch(error){console.error("admin_overview_failed",error);return Response.json({message:"La operación no está disponible."},{status:503});} }
