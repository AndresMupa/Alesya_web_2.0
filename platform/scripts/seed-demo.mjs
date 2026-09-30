// Creates fictional demo data (products, leads, orders, payments, inventory) in an empty database.
// Usage: npm run db:seed            → seeds TURSO_DATABASE_URL or .local/alesya.db
//        seedDemo(url) from other scripts (see prepare-demo-db.mjs).
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { fileURLToPath } from "node:url";

const DAY = 24 * 60 * 60 * 1000;

const products = [
  ["Kit Robótica EV3 Aula", "ROB-EV3-AULA", "Robótica", 1890000, 6, "Set LEGO EV3 con guía de 10 retos para grupos de 4 estudiantes."],
  ["Kit WeDo 2.0 Primaria", "ROB-WEDO-20", "Robótica", 1250000, 3, "Mecanismos, motor y sensores con fichas para primaria."],
  ["Arduino Uno Starter", "ELE-ARD-UNO", "Electrónica", 189000, 24, "Placa compatible, protoboard, cables y 30 componentes."],
  ["Sensor ultrasónico HC-SR04", "ELE-SEN-HCSR", "Electrónica", 18000, 2, "Sensor de distancia para robots que esquivan obstáculos."],
  ["Filamento PLA 1 kg", "FAB-PLA-1KG", "Impresión 3D", 95000, 40, "Filamento PLA de 1,75 mm en colores surtidos."],
  ["Impresora 3D escolar", "FAB-IMP-ESC", "Impresión 3D", 2490000, 1, "Impresora de cama caliente con carcasa cerrada para aula."],
  ["Kit de bricolaje mecánico", "BRI-MEC-01", "Bricolaje", 145000, 15, "Poleas, engranajes y ejes en madera para máquinas simples."],
  ["Libro Robótica en el aula", "LIB-ROB-AULA", "Libros", 89000, 30, "Guía docente con 24 sesiones de robótica educativa."],
];

const leads = [
  ["Laura Méndez", "Colegio San Rafael", "new", null, "Queremos un laboratorio de robótica para 6.º a 9.º grado."],
  ["Carlos Pineda", "Institución Educativa La Esperanza", "new", null, "Necesitamos formación docente en Arduino para 12 profesores."],
  ["Diana Rojas", "Gimnasio Los Andes", "new", null, "Cotización de 8 kits WeDo para primaria."],
  ["Jorge Salazar", "Fundación Semillas Tech", "contacted", "Andrés", "Proyecto de cultura maker en 3 sedes rurales."],
  ["Paola Castaño", "Colegio Bilingüe Horizonte", "contacted", "Andrés", "Impresión 3D para clases de diseño en bachillerato."],
  ["Miguel Torres", "Secretaría de Educación de Funza", "contacted", "Laura", "Convocatoria de dotación tecnológica 2027."],
  ["Natalia Vargas", "Liceo Moderno", "proposal", "Andrés", "Programa anual de robótica con acompañamiento."],
  ["Felipe Ocampo", "Colegio Campestre El Roble", "proposal", "Laura", "Renovación de kits EV3 y capacitación."],
  ["Andrea Gil", "Academia Pequeños Inventores", "proposal", "Andrés", "Kits de bricolaje para vacaciones recreativas."],
  ["Ricardo Luna", "Colegio Santa María", "won", "Andrés", "Laboratorio STEM completo para bachillerato."],
  ["Sofía Herrera", "Corporación Educar", "won", "Laura", "Libros y kits para 4 instituciones aliadas."],
  ["Tomás Beltrán", "Colegio Nuevo Mundo", "lost", "Laura", "Buscaban solo equipos, sin formación."],
];

const customers = [
  ["María Fernanda Rojas", "Bogotá"], ["Colegio Santa María", "Chía"], ["Juan Pablo Díaz", "Medellín"], ["Corporación Educar", "Funza"],
  ["Valentina Cruz", "Cali"], ["Gimnasio Los Andes", "Bogotá"], ["Santiago Ramírez", "Bucaramanga"], ["Camila Ortiz", "Barranquilla"],
  ["Liceo Moderno", "Mosquera"], ["Daniel Suárez", "Pereira"], ["Isabela Moreno", "Manizales"], ["Colegio Campestre El Roble", "Cajicá"],
  ["Andrés Quintero", "Villavicencio"], ["Mariana López", "Tunja"], ["Sebastián Parra", "Bogotá"], ["Fundación Semillas Tech", "Zipaquirá"],
];
// [customer index, product index, quantity, order status, payment status, days ago]
const orders = [
  [0, 2, 2, "paid", "approved", 1], [1, 0, 3, "preparing", "approved", 2], [2, 7, 1, "shipped", "approved", 4], [3, 7, 12, "delivered", "approved", 6],
  [4, 4, 3, "payment_pending", "pending", 0], [5, 1, 2, "paid", "approved", 3], [6, 3, 4, "payment_declined", "declined", 5], [7, 6, 1, "delivered", "approved", 9],
  [8, 0, 2, "delivered", "approved", 12], [9, 2, 1, "payment_review", "review", 2], [10, 4, 2, "cancelled", "pending", 8], [11, 5, 1, "shipped", "approved", 7],
  [12, 7, 2, "delivered", "approved", 35], [13, 2, 3, "delivered", "approved", 40], [14, 6, 2, "delivered", "approved", 45], [15, 1, 1, "delivered", "approved", 38],
];

const slugify = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const emailFor = (name) => `${slugify(name).replace(/-/g, ".")}@example.com`;

export async function seedDemo(url) {
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    const existing = await client.execute("select (select count(*) from products) + (select count(*) from leads) + (select count(*) from orders) as total");
    if (Number(existing.rows[0].total) > 0) { console.log("La base ya tiene datos; no se cargaron datos de prueba."); return false; }

    const now = Date.now(), statements = [];
    const productRows = products.map(([name, sku, category, price, stock, description], index) => ({ id: randomUUID(), slug: slugify(name), name, sku, category, priceInCents: price * 100, stock, description, createdAt: now - (60 - index) * DAY }));
    for (const p of productRows) {
      statements.push({ sql: "insert into products (id, slug, sku, name, description, category, price_in_cents, stock, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)", args: [p.id, p.slug, p.sku, p.name, p.description, p.category, p.priceInCents, p.stock, p.createdAt, p.createdAt] });
      statements.push({ sql: "insert into inventory_events (id, product_id, quantity_delta, reason, created_at) values (?, ?, ?, 'initial_stock', ?)", args: [randomUUID(), p.id, p.stock, p.createdAt] });
    }
    leads.forEach(([name, organization, stage, owner, message], index) => {
      const at = now - (index * 1.7 + 0.2) * DAY;
      statements.push({ sql: "insert into leads (id, name, organization, email, phone, message, source, stage, owner, created_at, updated_at) values (?, ?, ?, ?, ?, ?, 'website', ?, ?, ?, ?)", args: [randomUUID(), name, organization, emailFor(name), `300 000 ${String(1000 + index).slice(-4)}`, message, stage, owner, at, at] });
    });
    orders.forEach(([customerIndex, productIndex, quantity, status, paymentStatus, daysAgo], index) => {
      const [customerName, city] = customers[customerIndex], product = productRows[productIndex];
      const orderId = randomUUID(), at = now - daysAgo * DAY - index * 3600_000, total = product.priceInCents * quantity;
      const reference = `DEMO-${String(1000 + index)}`;
      statements.push({ sql: "insert into orders (id, reference, customer_name, customer_email, customer_phone, shipping_city, shipping_address, subtotal_in_cents, total_in_cents, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [orderId, reference, customerName, emailFor(customerName), "300 000 0000", city, "Dirección de prueba", total, total, status, at, at] });
      statements.push({ sql: "insert into order_items (id, order_id, product_slug, product_name, quantity, unit_price_in_cents, line_total_in_cents) values (?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), orderId, product.slug, product.name, quantity, product.priceInCents, total] });
      statements.push({ sql: "insert into payments (id, order_id, provider, provider_transaction_id, reference, method, status, amount_in_cents, created_at, updated_at) values (?, ?, 'wompi', ?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), orderId, paymentStatus === "pending" ? null : `demo-tx-${index}`, reference, paymentStatus === "pending" ? null : ["NEQUI", "PSE", "CARD", "BANCOLOMBIA_TRANSFER"][index % 4], paymentStatus, total, at, at] });
      if (paymentStatus === "approved") {
        statements.push({ sql: "update products set stock = stock - ? where id = ?", args: [quantity, product.id] });
        statements.push({ sql: "insert into inventory_events (id, product_id, quantity_delta, reason, order_id, created_at) values (?, ?, ?, 'sale', ?, ?)", args: [randomUUID(), product.id, -quantity, orderId, at] });
      }
    });
    await client.batch(statements, "write");
    console.log(`Datos de prueba cargados: ${products.length} productos, ${leads.length} contactos, ${orders.length} pedidos.`);
    return true;
  } finally { client.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.TURSO_DATABASE_URL || "file:.local/alesya.db";
  if (!url.startsWith("file:") && !process.argv.includes("--remote")) throw new Error("Por seguridad, los datos de prueba solo se cargan en bases locales. Usa --remote si de verdad quieres cargarlos en una base remota.");
  if (url === "file:.local/alesya.db") await mkdir(".local", { recursive: true });
  await seedDemo(url);
}
