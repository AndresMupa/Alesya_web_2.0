// Optimiza los medios de public/: comprime fotos, genera el logo ligero, los íconos, las carátulas de los videos y la
// imagen para compartir en redes. Es idempotente: una foto solo se reescribe si queda al menos un 10 % más liviana.
// Uso: node scripts/optimize-media.mjs   (requiere sharp, incluido con Next, y ffmpeg en el PATH para las carátulas)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const media = path.join(root, "public", "media");
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const log = (label, before, after) => console.log(`${label.padEnd(52)} ${before ? `${kb(before).padStart(8)} → ` : ""}${kb(after)}`);

/** Reescribe una foto JPEG reducida al lado mayor indicado, sin metadatos (EXIF con GPS incluido). */
async function recompressJpeg(file, maxSide) {
  const input = readFileSync(file);
  const output = await sharp(input).rotate().resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true, progressive: true }).toBuffer();
  if (output.length < input.length * 0.9) { writeFileSync(file, output); log(path.relative(root, file), input.length, output.length); }
}

async function photos() {
  for (const name of readdirSync(path.join(media, "productos"))) if (/\.jpe?g$/i.test(name)) await recompressJpeg(path.join(media, "productos", name), 1000);
  for (const name of ["clientes-robotica-ev3.jpeg", "clientes-lego-wedo.jpeg"]) await recompressJpeg(path.join(media, name), 1400);
}

/**
 * El logo X-Tech original es un trazado vectorial de ~10 MB (560 capas) que se muestra a ~50 px: se rasteriza a
 * 3× su tamaño en pantalla. El original vive en Recursos/ (fuera de la app) para no viajar en cada despliegue.
 */
async function logos() {
  const source = [path.join(root, "..", "Recursos", "alesya-x-tech-vector.svg"), path.join(media, "alesya-x-tech.svg")].find(existsSync);
  if (source) {
    const raster = sharp(readFileSync(source), { density: 72, limitInputPixels: false }).resize({ width: 168, height: 172, fit: "contain", background: "#f7f7f7" }).flatten({ background: "#f7f7f7" });
    const webp = await raster.clone().webp({ quality: 88, effort: 6 }).toBuffer();
    const png = await raster.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    writeFileSync(path.join(media, "alesya-x-tech.webp"), webp); log("public/media/alesya-x-tech.webp", statSync(source).size, webp.length);
    writeFileSync(path.join(media, "alesya-x-tech.png"), png); log("public/media/alesya-x-tech.png", 0, png.length);
  }
  const ediciones = path.join(media, "alesya-ediciones.png");
  const original = readFileSync(ediciones);
  const meta = await sharp(original).metadata();
  if (meta.width > 160) {
    const small = await sharp(original).resize({ width: 120, height: 120, fit: "inside" }).png({ compressionLevel: 9, palette: true }).toBuffer();
    writeFileSync(ediciones, small); log("public/media/alesya-ediciones.png", original.length, small.length);
  }
}

/** Íconos de pestaña, de pantalla de inicio (iOS/Android) y favicon.ico a partir de favicon.svg. */
async function icons() {
  const svg = readFileSync(path.join(root, "public", "favicon.svg"));
  const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 64) }).resize(size, size);
  for (const [name, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    const buffer = await render(size).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(path.join(root, "public", name), buffer); log(`public/${name}`, 0, buffer.length);
  }
  // favicon.ico: PNG de 48 px envuelto en el contenedor ICO (los navegadores modernos aceptan PNG dentro del ICO).
  const png = await render(48).png({ compressionLevel: 9 }).toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  const ico = Buffer.concat([header, png]);
  writeFileSync(path.join(root, "public", "favicon.ico"), ico); log("public/favicon.ico", 0, ico.length);
}

/** Carátula (primer fotograma útil) de cada video incluido: se ve mientras el video carga o si no se reproduce. */
async function posters() {
  const directory = path.join(media, "posters");
  mkdirSync(directory, { recursive: true });
  for (const name of readdirSync(media)) {
    if (!name.endsWith(".mp4")) continue;
    const frame = execFileSync("ffmpeg", ["-v", "error", "-ss", "1", "-i", path.join(media, name), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 64 * 1024 * 1024 });
    const jpeg = await sharp(frame).resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true, progressive: true }).toBuffer();
    const target = path.join(directory, name.replace(/\.mp4$/, ".jpg"));
    writeFileSync(target, jpeg); log(path.relative(root, target), 0, jpeg.length);
  }
}

/** Imagen de 1200×630 para compartir el sitio en WhatsApp, Facebook, LinkedIn y X. */
async function openGraph() {
  const photo = await sharp(readFileSync(path.join(media, "clientes-robotica-ev3.jpeg"))).resize(1200, 630, { fit: "cover", position: "attention" }).toBuffer();
  const font = "font-family=\"Segoe UI, Avenir Next, Helvetica, Arial, sans-serif\"";
  const shade = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#070e1a" stop-opacity=".94"/><stop offset=".6" stop-color="#070e1a" stop-opacity=".7"/><stop offset="1" stop-color="#070e1a" stop-opacity=".1"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>
    <text x="72" y="330" ${font} font-size="62" font-weight="700" fill="#ffffff">Robótica, Arduino</text>
    <text x="72" y="404" ${font} font-size="62" font-weight="700" fill="#ffffff">e impresión 3D</text>
    <text x="72" y="474" font-family="Georgia, serif" font-style="italic" font-size="50" fill="#d7ff43">para aprender haciendo.</text>
    <rect x="72" y="526" width="88" height="6" fill="#d7ff43"/>
    <text x="180" y="536" ${font} font-size="26" fill="#d3d7df">Kits, programas para colegios y formación docente · Colombia</text></svg>`);
  const logo = await sharp(readFileSync(path.join(media, "alesya-x-tech.png"))).resize(120, 123).toBuffer();
  const image = await sharp(photo).composite([{ input: shade }, { input: logo, top: 72, left: 72 }]).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  writeFileSync(path.join(media, "og-alesya.jpg"), image); log("public/media/og-alesya.jpg", 0, image.length);
}

await photos();
await logos();
await icons();
await posters();
await openGraph();
