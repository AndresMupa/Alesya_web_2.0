// Procesa las fotos de producto tomadas por el equipo: recorta el fondo blanco sobrante, centra el producto en un
// cuadrado blanco con margen, lo lleva a 1200 px y lo guarda en WebP sin metadatos (EXIF con GPS incluido).
// Cada foto se llama como su SKU (`HC-SR04.jpg`, y las tomas extra `HC-SR04-2.jpg`, `HC-SR04-3.jpg`) y sale como
// `public/media/productos/hc-sr04.webp`, `hc-sr04-2.webp`… Los SKU se validan contra inventario-alesya.csv.
// Uso: node scripts/process-product-photos.mjs <carpeta-de-fotos> [--sin-recorte] [--margen=0.08] [--actualizar-csv] [--prueba]
//   --sin-recorte     no recorta el fondo (para fotos con fondo de color o sombras que no se deben perder)
//   --margen=0.08     aire alrededor del producto, como fracción del lado (0 a 0.3)
//   --actualizar-csv  escribe la ruta de la foto principal en la columna `imagen` del inventario
//   --prueba          muestra qué haría sin escribir nada
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const output = path.join(root, "public", "media", "productos");
const inventory = path.join(root, "..", "inventario-alesya.csv");
const SIZE = 1200;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => Number(args.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1] ?? fallback);
const source = args.find((arg) => !arg.startsWith("--"));
if (!source || !existsSync(source)) {
  console.error("Indica la carpeta con las fotos: node scripts/process-product-photos.mjs <carpeta> [--prueba]");
  process.exit(1);
}
const margin = Math.min(0.3, Math.max(0, option("--margen", 0.08)));
const dryRun = flag("--prueba");

/** Lee el CSV del inventario respetando comillas (los nombres y notas pueden llevar comas). */
function parseCsv(text) {
  const rows = [[]];
  let field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { rows.at(-1).push(field); field = ""; }
    else if (char === "\n") { rows.at(-1).push(field.replace(/\r$/, "")); rows.push([]); field = ""; }
    else field += char;
  }
  if (field || rows.at(-1).length) rows.at(-1).push(field);
  return rows.filter((row) => row.length > 1 || row[0]);
}
const csvField = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const csvText = existsSync(inventory) ? readFileSync(inventory, "utf8") : "";
const newline = csvText.includes("\r\n") ? "\r\n" : "\n";
const rows = parseCsv(csvText);
const header = rows[0] ?? [];
const skuColumn = header.indexOf("sku_ref"), imageColumn = header.indexOf("imagen");
const skus = new Map(rows.slice(1).map((row, index) => [row[skuColumn]?.toUpperCase(), index + 1]));
if (!skus.size) console.warn("No se encontró inventario-alesya.csv: los SKU no se validan.");

/** `hc-sr04-2.jpg` → { sku: "HC-SR04", take: 2 }. La toma extra es un sufijo numérico que no forma parte del SKU. */
function parseName(file) {
  const base = path.parse(file).name.trim().toUpperCase().replace(/\s+/g, "-");
  if (skus.has(base)) return { sku: base, take: 1 };
  const match = base.match(/^(.*)-(\d{1,2})$/);
  if (match && (skus.has(match[1]) || !skus.size)) return { sku: match[1], take: Number(match[2]) };
  return { sku: base, take: 1 };
}

async function processPhoto(file) {
  const image = sharp(readFileSync(file), { failOn: "none" }).rotate();
  // trim() quita el borde parecido al color de la esquina superior izquierda (el fondo blanco de la toma).
  const trimmed = flag("--sin-recorte") ? await image.toBuffer() : await image.trim({ background: "#ffffff", threshold: 28 }).toBuffer().catch(() => image.toBuffer());
  // El producto se ajusta a un cuadrado interior y luego se le agrega el margen blanco hasta medir SIZE × SIZE.
  const pad = Math.round(SIZE * margin);
  return sharp(trimmed)
    .flatten({ background: WHITE })
    .resize({ width: SIZE - pad * 2, height: SIZE - pad * 2, fit: "contain", background: WHITE })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: WHITE })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();
}

const files = readdirSync(source).filter((name) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(name)).sort();
if (!files.length) { console.error(`No hay fotos en ${source}`); process.exit(1); }
if (!dryRun) mkdirSync(output, { recursive: true });

const main = new Map();
let skipped = 0;
for (const file of files) {
  const { sku, take } = parseName(file);
  if (skus.size && !skus.has(sku)) { console.warn(`  ✗ ${file}: el SKU ${sku} no está en el inventario (se omite)`); skipped++; continue; }
  const name = `${sku.toLowerCase()}${take > 1 ? `-${take}` : ""}.webp`;
  if (dryRun) { console.log(`  · ${file} → public/media/productos/${name}`); }
  else {
    const buffer = await processPhoto(path.join(source, file)).catch((error) => { console.warn(`  ✗ ${file}: ${error.message}`); return null; });
    if (!buffer) { skipped++; continue; }
    writeFileSync(path.join(output, name), buffer);
    console.log(`  ✓ ${file} → public/media/productos/${name} (${Math.round(buffer.length / 1024)} KB)`);
  }
  if (take === 1) main.set(sku, `/media/productos/${name}`);
}

if (flag("--actualizar-csv") && main.size && imageColumn >= 0) {
  for (const [sku, url] of main) rows[skus.get(sku)][imageColumn] = url;
  if (!dryRun) writeFileSync(inventory, `${rows.map((row) => row.map(csvField).join(",")).join(newline)}${newline}`);
  console.log(`${dryRun ? "Se actualizaría" : "Se actualizó"} la columna imagen de ${main.size} SKU en inventario-alesya.csv.`);
}
console.log(`${files.length - skipped} foto(s) ${dryRun ? "por procesar" : "procesadas"}, ${skipped} omitida(s).`);
