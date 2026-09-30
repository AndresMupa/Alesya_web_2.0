import { randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const production = flags.has("--production");
const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:setup -- [--production [--force]] administrator@example.com");
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const secret = randomBytes(48).toString("base64url");
if (production) {
  // Credentials for the cPanel environment; never touches .env.local.
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(".local/admin-cpanel.txt", `Alesya — acceso administrativo (producción / cPanel)\nCorreo: ${email}\nContraseña: ${password}\n\nPega estas variables en "Setup Node.js App" de cPanel:\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}\n\nConserva la contraseña en tu gestor de contraseñas y borra este archivo después. No lo subas al repositorio.\n`, { mode: 0o600, flag: flags.has("--force") ? "w" : "wx" }).catch((e) => {
    if (e.code === "EEXIST") throw new Error(".local/admin-cpanel.txt already exists. Move it away or pass --force to overwrite it.");
    throw e;
  });
  console.log("Production admin credentials written to .local/admin-cpanel.txt; excluded from Git and deployments.");
  process.exit(0);
}
let existing = "";
try { existing = await readFile(".env.local", "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
if (/^ADMIN_/m.test(existing)) throw new Error("Admin already configured. Preserve existing credentials or rotate explicitly.");
await writeFile(".env.local", `${existing}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}\n`, { mode: 0o600 });
await mkdir(".local", { recursive: true, mode: 0o700 });
await writeFile(".local/admin-access.txt", `Alesya — acceso administrativo\nCorreo: ${email}\nContraseña: ${password}\n\nConserva esta contraseña en tu gestor de contraseñas. No subas este archivo al repositorio.\n`, { mode: 0o600 });
console.log("Admin configured. Password stored only in .local/admin-access.txt; excluded from Git and deployments.");
