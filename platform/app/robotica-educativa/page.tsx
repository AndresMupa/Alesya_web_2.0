import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/seo";
import { jsonLd, siteUrl } from "@/lib/site";

// Dinámica para que el enlace canónico use el dominio de PRODUCTION_URL del servidor (no el del momento de compilar).
export const dynamic = "force-dynamic";

const title = "Qué es la robótica educativa y cómo empezar en el colegio";
const description = "Guía de Alesya para colegios en Colombia: compara MART-02, TECH-R3 y Arduino, organiza un piloto de robótica y evalúa lo que aprenden los estudiantes.";

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
        <p className="eyebrow">Guía de Alesya Ediciones</p>
        <h1>Qué es la robótica educativa y cómo empezar en el colegio</h1>

        <section>
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
          <h2>Cómo elegir entre MART-02, TECH-R3 y Arduino</h2>
          <p>Elige según lo que quieras enseñar. Para observar cómo un mecanismo cambia el movimiento, empieza con MART-02. Para programar un robot que toma decisiones a partir de sensores, elige TECH-R3. Si la meta es construir y entender el circuito, usa Arduino.</p>
          <ul>
            <li><Link href="/proyectos?categoria=MART-02">MART-02</Link>, compatible con LEGO WeDo, para retos de máquinas simples desde los 7 años.</li>
            <li><Link href="/proyectos?categoria=TECH-R3">TECH-R3</Link>, compatible con LEGO EV3, para construcción, sensores, motores y programación por bloques desde los 10 años. La <Link href="/catalogo/ruta-lego-ev3">Ruta TECH-R3</Link> reúne ocho retos con criterios de evaluación.</li>
            <li><Link href="/catalogo/kit-arduino-explorador">Arduino</Link>, para trabajar con sensores, luces y circuitos. La biblioteca de Alesya incluye circuitos iniciales desde los 8 años y un robot que esquiva obstáculos desde los 11.</li>
            <li><Link href="/proyectos?categoria=Impresi%C3%B3n%203D">Impresión 3D</Link>, para diseñar y fabricar piezas funcionales desde los 12 años. Puede complementar una ruta de robótica con un reto de diseño.</li>
          </ul>
          <p>Las edades son orientativas. Antes de comprar, prueba una actividad con el equipo que tiene el colegio y comprueba que las piezas, el software y los dispositivos funcionan juntos.</p>
        </section>

        <section>
          <h2>Cómo organizar un piloto de robótica en el colegio</h2>
          <p>Empieza con un curso, un docente y un resultado observable. Antes de ampliar el programa, comprueba cuánto tiempo toma preparar los materiales, si todos los equipos pueden participar y si los estudiantes pueden explicar lo que construyeron.</p>
          <h3>Ejemplo de cuatro sesiones para primaria con MART-02</h3>
          <p>Este piloto parte del proyecto de máquinas simples de Alesya. El reto consiste en construir un mecanismo, cambiar una pieza y explicar cómo cambió el movimiento.</p>
          <ol>
            <li><strong>Predecir.</strong> Cada equipo dibuja el mecanismo y anticipa qué ocurrirá al moverlo.</li>
            <li><strong>Construir.</strong> Arma un modelo de referencia y registra cómo se mueve. Usa la misma posición de partida para repetir la prueba.</li>
            <li><strong>Modificar.</strong> Cambia una sola pieza, como la longitud de una palanca si el modelo lo permite. Compara el resultado antes y después del cambio.</li>
            <li><strong>Explicar.</strong> Cada equipo muestra los dos resultados y explica qué observó, si coincidió con su predicción y qué volvería a probar.</li>
          </ol>
          <h3>Qué registrar antes de ampliar el programa</h3>
          <ul>
            <li><strong>Aprendizaje:</strong> cada equipo documenta una predicción, una prueba repetida y una explicación que use lo observado.</li>
            <li><strong>Participación:</strong> alterna quién construye, quién prueba y quién registra para comprobar que todos practican.</li>
            <li><strong>Logística:</strong> anota cuántos equipos trabajaron en paralelo, qué piezas faltaron y cuánto tiempo tomó preparar y recoger el material.</li>
          </ul>
          <p>Con esas evidencias, decide si conviene repetir el piloto, ajustar la actividad o incorporar otro curso. Para planear la dotación, la formación docente y el seguimiento, consulta el <Link href="/colegios">programa de robótica para colegios</Link>.</p>
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
