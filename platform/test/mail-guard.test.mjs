import assert from "node:assert/strict";
import { test } from "node:test";
import { assessEmail, baseDomain, extractLinks, extractUrls } from "../lib/mail-guard.ts";

// Remitentes y dominios de ejemplo (.test / .example): ninguno es real.
const base = { replyTo: null, links: [], attachments: [], headers: {}, ownDomains: ["alesyaediciones.com"], brands: ["alesya", "alesyaediciones"] };
const mail = (overrides) => assessEmail({ ...base, from: { name: "", address: "persona@colegio-ejemplo.edu.co" }, subject: "", text: "", ...overrides });
const codes = (result) => result.signals.map((signal) => signal.code).sort();

test("solicitud real de un colegio: sin riesgo", () => {
  const result = mail({
    from: { name: "Rectoría Colegio Ejemplo", address: "rectoria@colegio-ejemplo.edu.co" },
    subject: "Cotización kits de robótica",
    text: "Buenas tardes, queremos cotizar 30 kits para grado sexto. Nuestro equipo ganó el premio regional de robótica el año pasado. Quedo atento, 3001234567.",
    headers: { "authentication-results": "mx.alesyaediciones.com; spf=pass smtp.mailfrom=colegio-ejemplo.edu.co; dkim=pass; dmarc=pass" },
  });
  assert.equal(result.level, "ok");
  assert.deepEqual(result.signals, []);
});

test("nominación a un premio que vende paquetes: sospechoso", () => {
  const result = mail({
    from: { name: "Campaign Consultant", address: "nominations@awards-news.example" },
    subject: "Can we nominate Alesya Ediciones S.A.S.?",
    text: "I'm coordinating nominations for the Business Awards 2027 and would like to invite your company to be an official nominee. Accept your nomination below or drop me a reply to join the shortlist! All awardees can opt for complimentary recognition, with optional promotional extras to boost visibility.",
    links: [{ href: "https://awards-news.example/accept?id=1", text: "Accept Nomination" }],
    headers: { "list-unsubscribe": "<https://awards-news.example/unsub>" },
  });
  assert.equal(result.level, "suspicious");
  assert.deepEqual(codes(result), ["award"]);
});

test("phishing de buzón con SPF fallido y enlace engañoso: peligroso", () => {
  const result = mail({
    from: { name: "Soporte de correo", address: "admin@mail-soporte.example" },
    subject: "Su buzón está lleno",
    text: "Su buzon lleno impide recibir mensajes. Verifique su cuenta en las próximas 24 horas, de lo contrario será suspendida.",
    links: [{ href: "http://185.22.10.4/login", text: "https://webmail.alesyaediciones.com" }],
    headers: { "authentication-results": "mx.alesyaediciones.com; spf=fail smtp.mailfrom=mail-soporte.example; dmarc=none" },
  });
  assert.equal(result.level, "dangerous");
  for (const code of ["credentials", "link-ip", "link-mismatch", "spf"]) assert.ok(codes(result).includes(code), code);
  assert.equal(result.score, 100);
});

test("suplantación del propio dominio: peligroso aunque el texto sea inocente", () => {
  const result = mail({
    from: { name: "Gerencia", address: "gerencia@alesyaediciones.com" },
    subject: "Pendiente",
    text: "Hola, ¿estás disponible?",
    headers: { "authentication-results": "mx.alesyaediciones.com; spf=fail; dkim=none; dmarc=fail header.from=alesyaediciones.com" },
  });
  assert.equal(result.level, "dangerous");
  assert.ok(codes(result).includes("spoof-own"));
});

test("dominio parecido y fraude de cambio de cuenta bancaria: peligroso", () => {
  const result = mail({
    from: { name: "Alesya Ediciones", address: "pagos@alesya-ediciones.example" },
    subject: "Actualización de datos",
    text: "Le informamos el cambio de nuestra cuenta bancaria para el pago de la factura. Por favor realice la transferencia hoy.",
  });
  assert.equal(result.level, "dangerous");
  for (const code of ["lookalike", "brand-name", "payment"]) assert.ok(codes(result).includes(code), code);
});

test("errores de una letra en el dominio se reconocen", () => {
  const result = mail({ from: { name: "", address: "ventas@alesyaedicione.com" }, text: "Hola" });
  assert.ok(codes(result).includes("lookalike"));
});

test("adjuntos ejecutables, HTML y doble extensión", () => {
  const result = mail({ text: "Adjunto la factura", attachments: ["Factura_0981.pdf.exe", "pago.html"] });
  assert.equal(result.level, "dangerous");
  for (const code of ["attach-exec", "attach-double", "attach-html"]) assert.ok(codes(result).includes(code), code);
  assert.equal(mail({ text: "Adjunto el listado", attachments: ["listado-estudiantes.xlsx", "foto.jpg"] }).level, "ok");
});

test("boletín legítimo con enlaces de seguimiento: sin riesgo", () => {
  const result = mail({
    from: { name: "Revista Educación", address: "boletin@revista-educacion.example" },
    subject: "Novedades de octubre",
    text: "Lea las novedades del mes en www.revista-educacion.example",
    links: [{ href: "https://u123.ct.sendgrid.net/ls/click?upn=abc", text: "www.revista-educacion.example" }, { href: "https://revista-educacion.example/octubre", text: "revista-educacion.example/octubre" }],
  });
  assert.equal(result.level, "ok");
});

test("la urgencia sola no cuenta", () => {
  assert.equal(mail({ text: "Necesitamos la cotización urgente, de inmediato por favor." }).score, 0);
});

test("SpamAssassin del servidor suma puntos", () => {
  const result = mail({ text: "Hola", headers: { "x-spam-status": "No, score=6.2 required=5.0" } });
  assert.ok(codes(result).includes("spamassassin"));
});

test("extracción de enlaces y dominios", () => {
  assert.deepEqual(extractLinks('<p>Hola <a class="x" href="https://a.example/?a=1&amp;b=2"><b>Entrar</b></a></p>'), [{ href: "https://a.example/?a=1&b=2", text: "Entrar" }]);
  assert.deepEqual(extractUrls("ver https://a.example/x, y (http://b.example)").map((link) => link.href), ["https://a.example/x", "http://b.example"]);
  assert.equal(baseDomain("mail.colegio.edu.co"), "colegio.edu.co");
  assert.equal(baseDomain("www.alesyaediciones.com"), "alesyaediciones.com");
});
