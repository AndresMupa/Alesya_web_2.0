import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/import-school-leads.mjs prepared-leads.json");
const records = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(records) || records.some((record) => !record.externalId || !record.organization)) {
  throw new Error("The import file must contain school records with externalId and organization.");
}

const db = createClient({ url: "file:.local/alesya.db" });
const sql = `INSERT INTO leads
  (id,name,organization,email,phone,message,source,stage,owner,external_id,city,priority,website,notes,last_contact,next_follow_up,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(external_id) DO NOTHING`;
let inserted = 0;
const now = Date.now();
try {
  for (let index = 0; index < records.length; index += 100) {
    const batch = records.slice(index, index + 100).map((record) => ({
      sql,
      args: [
        crypto.randomUUID(), record.name || "Equipo directivo", record.organization,
        record.email || null, record.phone || null,
        "Prospecto institucional de la base de colegios 2026. Verificar datos antes del primer contacto.",
        "base_colegios_2026", "new", record.owner || null, record.externalId,
        record.city || null, record.priority || "medium", record.website || null,
        record.notes || "", record.lastContact || null, record.nextFollowUp || null,
        now, now,
      ],
    }));
    const results = await db.batch(batch, "write");
    inserted += results.reduce((sum, result) => sum + result.rowsAffected, 0);
  }
  console.log(`Imported ${inserted} new schools; ${records.length - inserted} already existed.`);
} finally {
  db.close();
}
