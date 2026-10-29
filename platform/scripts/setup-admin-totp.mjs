import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Segundo factor del panel: secreto TOTP (RFC 6238) y códigos de recuperación de un solo uso. Mismo formato que lib/totp.ts.
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const production = flags.has("--production");
const force = flags.has("--force");
const quiet = flags.has("--quiet");
const usage = "Usage: npm run admin:totp -- [--production] [--force] [--quiet] [administrator@example.com]";
const unknown = [...flags].filter((f) => !["--production", "--force", "--quiet"].includes(f));
if (unknown.length) throw new Error(usage);
let account = args.find((a) => !a.startsWith("--"));
if (account && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) throw new Error(usage);

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  return bits ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}
const randomCode = () => Array.from(randomBytes(16), (b) => ALPHABET[b & 31]).join("");
const hashCode = (code) => createHash("sha256").update(`alesya-admin-recovery:${code}`).digest("hex");

let existing = "";
try { existing = await readFile(".env.local", "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
account ??= existing.match(/^ADMIN_EMAIL=(.+)$/m)?.[1]?.trim() || "administrador";

const secret = base32(randomBytes(20));
const codes = Array.from({ length: 10 }, randomCode);
const hashes = codes.map(hashCode).join(",");
const issuer = "Alesya Ediciones";
const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
const readable = codes.map((c) => c.match(/.{4}/g).join("-"));
const envLines = `ADMIN_TOTP_SECRET=${secret}\nADMIN_RECOVERY_HASHES=${hashes}\n`;

if (!production && /^ADMIN_TOTP_SECRET=/m.test(existing) && !force) throw new Error("Two-step verification already configured in .env.local. Pass --force to rotate it.");
const where = production ? ".local/admin-totp-cpanel.txt" : ".local/admin-totp.txt";
const body = `Alesya — verificación en dos pasos del panel (${production ? "producción / cPanel" : "local"})\nCuenta: ${account}\n\n1) Agrega la cuenta en tu app autenticadora (Google Authenticator, Authy…):\n   - con un lector de QR sobre este URI, o\n   - "Ingresar clave de configuración", tipo basado en tiempo, clave: ${secret}\n   URI: ${uri}\n\n2) Códigos de recuperación (cada uno sirve UNA vez; guárdalos en tu gestor de contraseñas, no en el teléfono):\n${readable.map((c) => `   ${c}`).join("\n")}\n\n3) ${production ? 'Pega estas variables en "Setup Node.js App" de cPanel y pulsa Restart' : "Estas variables ya quedaron en .env.local; reinicia el servidor"}:\n${envLines}\nBorra este archivo cuando termines. No lo subas al repositorio.\n`;
await mkdir(".local", { recursive: true, mode: 0o700 });
await writeFile(where, body, { mode: 0o600, flag: force ? "w" : "wx" }).catch((e) => {
  if (e.code === "EEXIST") throw new Error(`${where} already exists. Move it away or pass --force to overwrite it.`);
  throw e;
});

if (!production) {
  const kept = existing.split(/\r?\n/).filter((line) => !/^ADMIN_(TOTP_SECRET|RECOVERY_HASHES)=/.test(line)).join("\n").replace(/\n+$/, "");
  await writeFile(".env.local", `${kept}${kept ? "\n" : ""}${envLines}`, { mode: 0o600 });
}

console.log(`Verificación en dos pasos generada. Detalle y variables en ${where}; excluido de Git y de los despliegues.`);
if (!quiet) console.log(`\nURI para la app autenticadora (genera un QR local con él, o escribe la clave a mano):\n${uri}\n\nCódigos de recuperación (un solo uso cada uno):\n${readable.join("\n")}\n\nVuelve a ejecutarlo con --quiet si no quieres ver esto en la terminal.`);
