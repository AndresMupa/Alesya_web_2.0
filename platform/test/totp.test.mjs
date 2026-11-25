import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { base32Decode, base32Encode, findRecoveryHash, hashRecoveryCode, hotp, matchTotp, normalizeRecoveryCode, parseRecoveryHashes } from "../lib/totp.ts";

const secret = Buffer.from("12345678901234567890");

// Vectores de RFC 6238 (SHA-1); el RFC usa 8 dígitos, aquí son los 6 últimos.
test("códigos de RFC 6238", () => {
  for (const [seconds, code] of [[59, "287082"], [1111111109, "081804"], [1234567890, "005924"], [2000000000, "279037"]]) {
    assert.equal(matchTotp(secret, code, seconds * 1000, 0), Math.floor(seconds / 30));
  }
});

test("tolerancia de ±1 paso y rechazo fuera de ella", () => {
  const now = 1_700_000_000_000, step = Math.floor(now / 30000);
  for (const offset of [-1, 0, 1]) assert.equal(matchTotp(secret, hotp(secret, step + offset), now), step + offset);
  for (const offset of [-2, 2, -10]) assert.equal(matchTotp(secret, hotp(secret, step + offset), now), null);
});

test("formato del código", () => {
  const now = 1_700_000_000_000, code = hotp(secret, Math.floor(now / 30000));
  assert.equal(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now) !== null, true);
  for (const bad of ["", "12345", "1234567", "abcdef", `${code}0`]) assert.equal(matchTotp(secret, bad, now), null);
});

test("base32 ida y vuelta", () => {
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.deepEqual(base32Decode("mzxw 6ytb-oi=="), Buffer.from("foobar"));
  assert.equal(base32Decode("MZXW1"), null);
  assert.equal(base32Decode(" "), null);
});

test("códigos de recuperación", () => {
  const code = "ABCD-EFGH-2345-6723", hash = hashRecoveryCode(normalizeRecoveryCode(code));
  assert.equal(findRecoveryHash("abcd efgh 2345 6723", [hash]), hash);
  assert.equal(findRecoveryHash("ABCD-EFGH-2345-6724", [hash]), null);
  assert.equal(findRecoveryHash("ABCD", [hash]), null);
  assert.deepEqual(parseRecoveryHashes(` ${hash}, nope,${hash.toUpperCase()}`), [hash, hash]);
});

test("npm run admin:totp genera un secreto y hashes que el servidor entiende", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "alesya-totp-"));
  try {
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "setup-admin-totp.mjs");
    const stdout = execFileSync(process.execPath, [script, "--production", "--quiet", "prueba@example.com"], { cwd, encoding: "utf8" });
    assert.doesNotMatch(stdout, /secret=|[A-Z2-7]{4}-[A-Z2-7]{4}/);
    const text = readFileSync(path.join(cwd, ".local", "admin-totp-cpanel.txt"), "utf8");
    const generated = base32Decode(text.match(/^ADMIN_TOTP_SECRET=(.+)$/m)[1]);
    assert.equal(generated.length, 20);
    const hashes = parseRecoveryHashes(text.match(/^ADMIN_RECOVERY_HASHES=(.+)$/m)[1]);
    const codes = [...text.matchAll(/^ {3}([A-Z2-7]{4}(?:-[A-Z2-7]{4}){3})$/gm)].map((m) => m[1]);
    assert.equal(codes.length, 10);
    assert.equal(hashes.length, 10);
    for (const code of codes) assert.notEqual(findRecoveryHash(code, hashes), null);
    assert.throws(() => execFileSync(process.execPath, [script, "--production", "--quiet"], { cwd, stdio: "pipe" }), /already exists/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
