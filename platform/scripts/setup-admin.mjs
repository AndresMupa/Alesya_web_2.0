import { randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:setup -- administrator@example.com");
let existing = "";
try { existing = await readFile(".env.local", "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
if (/^ADMIN_/m.test(existing)) throw new Error("Admin already configured. Preserve existing credentials or rotate explicitly.");
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const secret = randomBytes(48).toString("base64url");
await writeFile(".env.local", `${existing}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}\n`, { mode: 0o600 });
await mkdir(".local", { recursive: true, mode: 0o700 });
await writeFile(".local/admin-access.txt", `Alesya — acceso administrativo\nCorreo: ${email}\nContraseña: ${password}\n\nConserva esta contraseña en tu gestor de contraseñas. No subas este archivo al repositorio.\n`, { mode: 0o600 });
console.log("Admin configured. Password stored only in .local/admin-access.txt; excluded from Git and deployments.");
