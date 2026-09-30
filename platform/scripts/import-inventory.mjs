// Importa el inventario real desde ../../inventario-alesya.csv a la tabla products.
// Es idempotente: un SKU que ya existe se actualiza (nombre, categoría, descripción y foto si el CSV la trae).
// En producción (sin shell) se usa el mismo archivo desde el panel: Productos → Importar CSV.
// Uso: node --env-file-if-exists=.env.local scripts/import-inventory.mjs
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CSV = fileURLToPath(new URL("../../inventario-alesya.csv", import.meta.url));

function parseCsv(text) {
  const rows = [];
  let field = "", record = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; if (field !== "" || record.length) { record.push(field); rows.push(record); record = []; field = ""; } }
    else field += c;
  }
  if (field !== "" || record.length) { record.push(field); rows.push(record); }
  return rows;
}

const slugify = (v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const url = process.env.TURSO_DATABASE_URL || "file:.local/alesya.db";
  if (!url.startsWith("file:") && !process.argv.includes("--remote")) throw new Error("Para una base remota, pasa --remote explícitamente.");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const [header, ...rows] = parseCsv(await readFile(CSV, "utf8"));
    const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    const existing = new Set((await client.execute("select sku from products")).rows.map((r) => String(r.sku)));
    const positions = {};
    const now = Date.now();
    let created = 0, updated = 0;
    const statements = [];
    for (const row of rows) {
      if (!row.length || !row[col.nombre]?.trim()) continue;
      const name = row[col.nombre].trim();
      const category = (row[col.categoria] || "Electrónica").trim();
      const sku = (row[col.sku_ref] || slugify(name)).trim().toUpperCase();
      const stock = parseInt(row[col.cantidad] || "0", 10) || 0;
      const price = Math.round((parseFloat(row[col.precio_cop] || "0") || 0)) * 100;
      const description = (row[col.notas]?.trim() || `${name} — inventario Alesya.`);
      const imageUrl = col.imagen === undefined ? null : row[col.imagen]?.trim() || null;
      const position = (positions[category] ??= 0); positions[category]++;
      const status = price > 0 ? "active" : "draft";
      if (existing.has(sku)) {
        statements.push({ sql: "update products set name=?, category=?, description=?, image_url=coalesce(?, image_url), position=?, updated_at=? where sku=?", args: [name, category, description, imageUrl, position, now, sku] });
        updated++;
      } else {
        const id = randomUUID();
        statements.push({ sql: "insert into products (id, slug, sku, name, description, category, price_in_cents, stock, status, image_url, position, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)", args: [id, `${slugify(name)}-${id.slice(0, 5)}`, sku, name, description, category, price, stock, status, imageUrl, position, now, now] });
        if (stock) statements.push({ sql: "insert into inventory_events (id, product_id, quantity_delta, reason, created_at) values (?,?,?,?,?)", args: [randomUUID(), id, stock, "initial_stock", now] });
        created++;
      }
    }
    if (statements.length) await client.batch(statements, "write");
    console.log(`Inventario importado: ${created} nuevos, ${updated} actualizados.`);
  } finally { client.close(); }
}

main();
