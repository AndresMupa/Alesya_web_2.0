import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/seo";
import { jsonLd, siteUrl } from "@/lib/site";

// Dinámica para que el enlace canónico use el dominio de PRODUCTION_URL del servidor (no el del momento de compilar).
export const dynamic = "force-dynamic";

const title = "Qué es la robótica educativa y cómo empezar en el colegio";
const description = "Qué es la robótica educativa, qué aprenden los estudiantes con LEGO, Arduino e impresión 3D, y cómo un colegio puede empezar en Colombia.";

export const generateMetadata = () => pageMetadata({ title, description, path: "/robotica-educativa", type: "article" });

/** Artículo para Google y los asistentes de IA: define el tema y enlaza las páginas donde se compra o se pide un programa. */
const articleJsonLd = () => ({
  "@context": "https://schema.org", "@type": "Article", headline: title, description, inLanguage: "es-CO",
  url: `${siteUrl()}/robotica-educativa`, mainEntityOfPage: `${siteUrl()}/robotica-educativa`,
  author: { "@id": `${siteUrl()}/#organizacion` }, publisher: { "@id": `${siteUrl()}/#organizacion` },
});

export default function RoboticaEducativaPage() {
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd()) }} />
    <main className="legal-page page-width">
      <article className="legal-article">
        <p className="eyebrow">Guía</p>
        <h1>Qué es la robótica educativa</h1>
        <p className="legal-updated">{description}</p>

        <section>
          <h2>Aprender construyendo</h2>
          <p>La robótica educativa usa kits para que los estudiantes diseñen, construyan, programen y prueben máquinas que se mueven o reaccionan al entorno. El aprendizaje ocurre en el proceso: un mecanismo que no funciona obliga a revisar la idea, cambiar una pieza y volver a probar.</p>
        </section>

        <section>
          <h2>Qué se aprende</h2>
          <ul>
            <li>Pensamiento computacional: descomponer un problema en pasos y expresarlos como un programa.</li>
            <li>Mecanismos y física básica: engranajes, palancas, poleas y movimiento.</li>
            <li>Electrónica con sentido: sensores, actuadores y circuitos que responden a algo real.</li>
            <li>Trabajo en equipo, comunicación y resolución de problemas.</li>
          </ul>
        </section>

        <section>
          <h2>Tecnologías y edades sugeridas</h2>
          <p>Cada tecnología tiene su punto de entrada. En nuestros proyectos, las edades sugeridas van así:</p>
          <ul>
            <li>MART-02 (compatible con LEGO WeDo): mecanismos y máquinas simples, desde los 7 años.</li>
            <li>TECH-R3 (compatible con LEGO EV3): construcción, sensores, motores y programación por bloques, desde los 10 años.</li>
            <li>Arduino y electrónica: sensores, luces y circuitos, desde los 8 y 11 años según el proyecto.</li>
            <li>Impresión 3D y diseño: modelar y fabricar piezas funcionales, desde los 12 años.</li>
          </ul>
          <p>Puedes ver los retos completos en la <Link href="/proyectos">página de proyectos</Link>.</p>
        </section>

        <section>
          <h2>Cómo empezar en un colegio</h2>
          <p>Un programa de robótica educativa funciona mejor cuando se planea como un proceso, no como una compra de cajas. Un camino habitual incluye un diagnóstico del colegio, la dotación de kits, formación para los docentes, contenidos para el aula y seguimiento durante el año.</p>
          <p>Si tu institución quiere estudiar esa ruta, revisa el <Link href="/colegios">programa para colegios</Link> o lee las <Link href="/preguntas-frecuentes">preguntas frecuentes</Link>.</p>
        </section>

        <section>
          <h2>Para familias y estudiantes</h2>
          <p>Si quieres empezar en casa, la <Link href="/catalogo">tienda</Link> tiene kits de LEGO, Arduino, impresión 3D y bricolaje, además de libros con rutas pedagógicas y guías docentes.</p>
        </section>
      </article>
    </main>
    <SiteFooter />
  </div>;
}
