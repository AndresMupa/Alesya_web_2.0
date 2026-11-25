import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { credentialVersion } from "@/lib/admin-auth";
import { blockKey, claimOnce, countAttempt, isKeyBlocked } from "@/lib/rate-limit";
import { base32Decode, findRecoveryHash, matchTotp, parseRecoveryHashes } from "@/lib/totp";

const CHALLENGE_SECONDS = 5 * 60;
const CHALLENGE_ATTEMPTS = 3;
const TOTP_REUSE_WINDOW_MS = 2 * 60_000;
const RECOVERY_CODE_LIFETIME_MS = 10 * 365 * 24 * 60 * 60_000;

export type TwoFactorConfig = { state: "off" } | { state: "invalid" } | { state: "on"; secret: Buffer; recovery: string[] };

/**
 * `ADMIN_TOTP_SECRET` (base32) activa la verificación en dos pasos. Si no está definida el acceso funciona solo con contraseña; si está
 * definida pero no se puede leer, el acceso se rechaza (nunca se degrada en silencio a solo contraseña).
 * `ADMIN_RECOVERY_HASHES` trae los hashes SHA-256 de los códigos de recuperación (nunca los códigos).
 */
export function twoFactorConfig(): TwoFactorConfig {
  const raw = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!raw) return { state: "off" };
  const secret = base32Decode(raw);
  if (!secret || secret.length < 10) return { state: "invalid" };
  return { state: "on", secret, recovery: parseRecoveryHashes(process.env.ADMIN_RECOVERY_HASHES) };
}

// Clave propia para el paso intermedio: una firma de este token nunca coincide con la de una sesión (`sign` en admin-auth).
const challengeSignature = (payload: string) => createHmac("sha256", createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update("admin-2fa-challenge-key").digest()).update(payload).digest("base64url");

/** Token firmado de un solo propósito y vida corta que se entrega tras la contraseña correcta. No es una sesión: `getAdmin()` no lo acepta. */
export function makeChallenge() {
  const payload = Buffer.from(JSON.stringify({ purpose: "admin-2fa", email: process.env.ADMIN_EMAIL!.toLowerCase(), exp: Math.floor(Date.now() / 1000) + CHALLENGE_SECONDS, version: credentialVersion(), nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${challengeSignature(payload)}`;
}

function readChallenge(token: string) {
  if (token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(challengeSignature(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.purpose !== "admin-2fa" || typeof data.nonce !== "string" || typeof data.exp !== "number" || data.exp <= Date.now() / 1000) return null;
    if (data.version !== credentialVersion() || data.email !== process.env.ADMIN_EMAIL!.toLowerCase()) return null;
    return { nonce: data.nonce, exp: data.exp };
  } catch { return null; }
}

export type SecondFactorResult =
  | { ok: true; method: "totp" | "recovery" }
  | { ok: false; reason: "not_configured" | "challenge_invalid" | "challenge_attempts" | "code_invalid" | "code_reused" | "recovery_reused"; restart: boolean };

const fail = (reason: Extract<SecondFactorResult, { ok: false }>["reason"], restart = false): SecondFactorResult => ({ ok: false, reason, restart });

/**
 * Valida el código (TOTP de 6 dígitos o código de recuperación) contra un token de paso intermedio. Cada token admite pocos intentos,
 * un código TOTP solo se acepta una vez dentro de su ventana y cada código de recuperación, una sola vez.
 */
export async function verifySecondFactor(challengeToken: string, code: string): Promise<SecondFactorResult> {
  const config = twoFactorConfig();
  if (config.state !== "on") return fail("not_configured", true);
  const challenge = readChallenge(challengeToken);
  if (!challenge || await isKeyBlocked(`2fa-done:${challenge.nonce}`)) return fail("challenge_invalid", true);
  if (!await countAttempt(`2fa-tries:${challenge.nonce}`, CHALLENGE_ATTEMPTS, CHALLENGE_SECONDS * 1000)) return fail("challenge_attempts", true);
  if (code.length > 64) return fail("code_invalid");

  let method: "totp" | "recovery";
  const counter = matchTotp(config.secret, code);
  if (counter !== null) {
    if (!await claimOnce(`totp:${counter}`, TOTP_REUSE_WINDOW_MS)) return fail("code_reused");
    method = "totp";
  } else {
    const hash = findRecoveryHash(code, config.recovery);
    if (!hash) return fail("code_invalid");
    if (!await claimOnce(`recovery:${hash}`, RECOVERY_CODE_LIFETIME_MS)) return fail("recovery_reused");
    method = "recovery";
  }
  await blockKey(`2fa-done:${challenge.nonce}`, challenge.exp * 1000);
  return { ok: true, method };
}
