import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** TOTP (RFC 6238) con HMAC-SHA1, pasos de 30 s y 6 dígitos: lo que aceptan Google Authenticator, Authy y similares. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** Decodifica base32 (sin distinguir mayúsculas; ignora espacios, guiones y `=`). `null` si hay caracteres inválidos o queda vacío. */
export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean) return null;
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const totpCounter = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);

/**
 * Devuelve el contador del paso cuyo código coincide (tolerancia de ±`window` pasos por diferencia de reloj) o `null`.
 * Compara todos los pasos en tiempo constante, sin salir al primer acierto.
 */
export function matchTotp(secret: Buffer, code: string, nowMs = Date.now(), window = 1) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const given = Buffer.from(clean);
  const current = totpCounter(nowMs);
  let matched: number | null = null;
  for (let counter = current - window; counter <= current + window; counter++) {
    if (timingSafeEqual(Buffer.from(hotp(secret, counter)), given) && matched === null) matched = counter;
  }
  return matched;
}

/** Códigos de recuperación: 16 caracteres base32 (80 bits), escritos en grupos de 4. Solo se guarda su hash. */
export function normalizeRecoveryCode(input: string) {
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z2-7]{16}$/.test(clean) ? clean : null;
}

export const hashRecoveryCode = (normalized: string) => createHash("sha256").update(`alesya-admin-recovery:${normalized}`).digest("hex");

/** Hashes (hex, separados por comas o espacios) de la variable de entorno; descarta lo que no sea un SHA-256. */
export const parseRecoveryHashes = (raw: string | undefined) => (raw ?? "").split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter((item) => /^[a-f0-9]{64}$/.test(item));

/** Hash del código si está en la lista (comparación en tiempo constante contra todas), o `null`. */
export function findRecoveryHash(input: string, hashes: string[]) {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return null;
  const hash = hashRecoveryCode(normalized);
  let found: string | null = null;
  for (const candidate of hashes) if (timingSafeEqual(Buffer.from(candidate), Buffer.from(hash)) && found === null) found = hash;
  return found;
}
