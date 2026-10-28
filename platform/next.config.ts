import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the workspace root to this folder: otherwise Next.js walks up looking for lockfiles
// (one lives in the user's home) and warns; it also keeps `.next/standalone/server.js` flat.
const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Direcciones del sitio anterior en WordPress (www.alesyaediciones.com, ver wp-sitemap.xml) hacia su equivalente
 * en el sitio nuevo, con redirección permanente para conservar el posicionamiento al cambiar de dominio.
 * `{/}?` acepta la barra final de WordPress sin un salto extra. Las que existen igual (/carrito, /checkout y las
 * páginas legales) no necesitan redirección.
 */
const wordpress: [source: string, destination: string][] = [
  ["/shop", "/catalogo"], ["/tienda", "/catalogo"], ["/product/:slug*", "/catalogo"], ["/producto/:slug*", "/catalogo"],
  ["/product-category/robotica", "/catalogo?categoria=robotica"], ["/product-category/:slug*", "/catalogo"], ["/categoria-producto/:slug*", "/catalogo"],
  ["/cart", "/carrito"], ["/finalizar-compra", "/checkout"],
  ["/mi-cuenta/:path*", "/pedido"], ["/cuenta-de-usuario", "/pedido"], ["/iniciar-sesion", "/pedido"], ["/registro", "/pedido"], ["/forgot-password", "/pedido"], ["/restablecer-contrasena", "/pedido"], ["/lp-profile/:path*", "/pedido"], ["/lp-checkout", "/pedido"],
  ["/contacto", "/colegios#diagnostico"], ["/contact", "/colegios#diagnostico"], ["/faqs", "/colegios"],
  ["/about-us", "/#clientes"], ["/nosotros", "/#clientes"], ["/quienes-somos", "/#clientes"], ["/galeria", "/#clientes"],
  ["/robotica", "/proyectos"], ["/recursos", "/proyectos"], ["/videos-educativos", "/proyectos"],
  ["/literatura", "/catalogo?categoria=Libros"], ["/literatura-infantil-2", "/catalogo?categoria=Libros"], ["/literatura-juvenil-2", "/catalogo?categoria=Libros"], ["/literatura-adulta-2", "/catalogo?categoria=Libros"],
  ["/grado-:numero(\\d+)", "/catalogo?categoria=Libros"], ["/modulos-escolares", "/catalogo?categoria=Libros"], ["/area-ingles", "/catalogo?categoria=Libros"], ["/3d-flip-book/:slug*", "/catalogo?categoria=Libros"],
  ["/blog", "/"], ["/author/:slug*", "/"], ["/category/:slug*", "/"], ["/tag/:slug*", "/"], ["/mantenimiento", "/"],
  ["/wp-sitemap.xml", "/sitemap.xml"], ["/sitemap_index.xml", "/sitemap.xml"],
  // El logo vectorial de 10 MB se reemplazó por una versión de 12 KB; las páginas guardadas en caché aún lo piden.
  ["/media/alesya-x-tech.svg", "/media/alesya-x-tech.png"],
];

/**
 * Política de contenido completa, solo en modo reporte. Mientras Next inyecte guiones propios sin `nonce` hace falta
 * `'unsafe-inline'` en scripts y estilos; el siguiente paso es pasar a nonces desde proxy.ts (ver el informe de seguridad).
 * En desarrollo React necesita `'unsafe-eval'`.
 */
const reportOnlyPolicy = [
  "default-src 'self'", `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`, "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "media-src 'self' blob:", "connect-src 'self'", "worker-src 'self' blob:", "manifest-src 'self'",
  "frame-src 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  // Produce a self-contained Node.js server that can run under cPanel/Passenger.
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  // Seeded SQLite file for demo previews (DEMO_DATABASE=1); absent in normal builds.
  outputFileTracingIncludes: { "/**": ["./.demo/**/*"] },
  // pino (lo usa imapflow) arrastra las pruebas de thread-stream y sonic-boom, con .zip que llevan JavaScript: el
  // antivirus del hosting (ClamAV, Sanesecurity.Foxhole.JS_Zip) rechaza el paquete entero al subirlo.
  // sharp trae su alternativa en WebAssembly (@img/sharp-wasm32), que no sirve en este servidor (usa el binario nativo de Linux x64) y que el
  // validador del paquete rechaza como «paquete nativo ajeno»: se deja fuera del paquete.
  outputFileTracingExcludes: { "/**": ["node_modules/thread-stream/test/**", "node_modules/sonic-boom/test/**", "node_modules/@img/sharp-wasm32/**"] },
  // No anunciar la tecnología del servidor.
  poweredByHeader: false,
  // Next quitaría la barra final antes de las redirecciones propias (dos saltos para /about-us/). Se desactiva y la
  // regla genérica del final de redirects() hace lo mismo después de las de WordPress: un solo salto.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      ...wordpress.map(([source, destination]) => ({ source: `${source}{/}?`, destination, permanent: true })),
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ];
  },
  async headers() {
    // Fotos, videos e íconos de public/ no llevan huella en el nombre: una semana fresca y un mes sirviendo la copia
    // guardada mientras se revalida. Al reemplazar un archivo conviene cambiarle el nombre.
    const media = "public, max-age=604800, stale-while-revalidate=2592000";
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        // Directivas que se aplican ya: nadie puede enmarcar el sitio, cambiar su <base> ni mandar formularios a otro dominio.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        // Política completa en modo «solo reporte»: no bloquea nada, avisa a /api/csp-report qué cargaría un origen no previsto.
        { key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy },
      ] },
      // El panel y sus APIs nunca se guardan en cachés ni se indexan; las APIs y los archivos subidos no se incrustan desde otros sitios.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-site" }] },
      // Lo subido desde el panel se sirve inerte: sin guiones, estilos ni marcos aunque alguien lo abra directamente.
      { source: "/uploads/:file", headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-site" }, { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }] },
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: media }] },
      { source: "/:icon(favicon.ico|favicon.svg|apple-touch-icon.png|icon-192.png|icon-512.png)", headers: [{ key: "Cache-Control", value: media }] },
    ];
  },
};

export default nextConfig;
