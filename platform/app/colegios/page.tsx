import Link from "next/link";
import { ArrowRight, GraduationCap, School, ShieldCheck, Sparkles } from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/seo";
import { storeConfig } from "@/lib/settings";
import { jsonLd, siteUrl } from "@/lib/site";

// Dinámica para que el enlace canónico use el dominio de PRODUCTION_URL del servidor (no el del momento de compilar).
export const dynamic = "force-dynamic";

const description = "Programas de robótica educativa para colegios en Colombia con kits, proyectos y formación docente. Solicita un diagnóstico según los grados y recursos de tu institución.";
export const generateMetadata = () => pageMetadata({ title: "Robótica educativa para colegios en Colombia", description, path: "/colegios", image: { url: "/media/clientes-robotica-ev3.jpeg", alt: "Estudiantes presentando proyectos de robótica educativa" } });

const serviceJsonLd = () => ({
  "@context": "https://schema.org", "@type": "Service", name: "Programa de robótica educativa para colegios", serviceType: "Robótica educativa y cultura maker", description,
  provider: { "@id": `${siteUrl()}/#organizacion` }, areaServed: { "@type": "Country", name: "Colombia" }, audience: { "@type": "EducationalAudience", educationalRole: "school" }, url: `${siteUrl()}/colegios`,
});

export default async function SchoolsPage() {
  const config = await storeConfig().catch(() => null);
  const whatsapp = `https://wa.me/${config?.whatsappDigits ?? "573005937840"}?text=${encodeURIComponent("Hola, quiero conocer el programa de robótica para mi colegio. Vengo de la página de colegios.")}`;
  return <div className="site-shell schools-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceJsonLd()) }} />
    <div className="interior-header"><SiteHeader /></div>
    <main>
      <section className="page-hero schools-hero"><div className="page-width">
        <p className="eyebrow eyebrow-light">Alesya para instituciones educativas</p>
        <h1>Robótica para<br />todo el colegio.</h1>
        <p>Alesya X-Tech implementa programas de robótica educativa para colegios en Colombia. Diseñamos la ruta por grados según las metas de tu institución, con kits, proyectos de aula y formación docente.</p>
        <div className="schools-actions">
          <a className="button button-primary" href="#diagnostico">Solicitar diagnóstico <ArrowRight size={17} /></a>
          <a className="button button-ghost-light" href="#robotica-30-estudiantes">Ver ficha para 30 estudiantes</a>
          <a className="button button-ghost-light" href={whatsapp} target="_blank" rel="noopener noreferrer">Conversar por WhatsApp</a>
        </div>
      </div></section>
      <section className="section page-width schools-program">
        <div className="section-heading split-heading"><div><p className="eyebrow">De la idea al aula</p><h2>Una ruta para toda la comunidad educativa.</h2></div><p>La propuesta se ajusta al número de estudiantes, grados, recursos existentes y objetivos pedagógicos de cada institución. Consulta la <Link href="/robotica-educativa">guía para elegir un kit y organizar un piloto</Link>.</p></div>
        <div className="schools-steps">
          <article><School /><span>01</span><h3>Diagnóstico</h3><p>Conversamos sobre grados, cobertura y metas del colegio.</p></article>
          <article><Sparkles /><span>02</span><h3>Ruta pedagógica</h3><p>Definimos proyectos y contenidos adecuados para cada etapa.</p></article>
          <article><GraduationCap /><span>03</span><h3>Formación</h3><p>Acompañamos a los docentes para llevar la ruta al aula.</p></article>
          <article><ShieldCheck /><span>04</span><h3>Implementación</h3><p>Articulamos materiales, actividades y seguimiento.</p></article>
        </div>
      </section>
      <section className="section page-width schools-roster" id="robotica-30-estudiantes" aria-labelledby="robotica-30-titulo">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">Ficha para colegios</p><h2 id="robotica-30-titulo">Robótica educativa para 30 estudiantes</h2></div>
          <p>Un ejemplo para planear un curso: 10 equipos de 3 estudiantes que alternan los roles de construcción, programación y registro. Si todos trabajan al mismo tiempo, este esquema requiere 10 puestos de trabajo. La cantidad de kits se define según el reto, los recursos del colegio y si habrá rotación.</p>
        </div>
        <div className="schools-steps schools-roster-grid">
          <article>
            <h3>Kits según el grado</h3>
            <p><Link className="underlined-link" href="/proyectos?categoria=MART-02">MART-02</Link>, compatible con LEGO WeDo, para explorar máquinas simples y mecanismos en primaria. <Link className="underlined-link" href="/proyectos?categoria=TECH-R3">TECH-R3</Link>, compatible con LEGO EV3, para trabajar con motores, sensores y programación por bloques en grados más avanzados.</p>
          </article>
          <article>
            <h3>Guías para el aula</h3>
            <p>La <Link className="underlined-link" href="/catalogo/kit-mecanismos-wedo">dotación complementaria MART-02</Link> cuenta con fichas para máquinas simples. La <Link className="underlined-link" href="/catalogo/ruta-lego-ev3">Ruta TECH-R3</Link> reúne ocho retos de construcción y programación con criterios de evaluación. El diagnóstico ayuda a elegir los materiales para el grado y el reto.</p>
          </article>
          <article>
            <h3>Acompañamiento docente</h3>
            <p>Alesya ayuda a elegir los retos, preparar el uso de los kits y llevar la ruta al aula. El acompañamiento contempla formación docente y seguimiento de la implementación según el alcance acordado.</p>
          </article>
        </div>
        <div className="schools-roster-quote">
          <h3>Qué se define al cotizar</h3>
          <ul>
            <li>Modelo y cantidad de kits, piezas y consumibles, teniendo en cuenta el equipo disponible en el colegio.</li>
            <li>Retos y guías incluidos, cantidad de docentes, horas y modalidad de formación y alcance del seguimiento.</li>
            <li>Disponibilidad, plazos de entrega, garantías y reposición de piezas, valor total y condiciones de pago.</li>
          </ul>
          <a className="button button-primary" href="#diagnostico">Solicitar una propuesta para 30 estudiantes <ArrowRight size={17} /></a>
        </div>
      </section>
      <section className="schools-conversion page-width" id="diagnostico">
        <div><p className="eyebrow eyebrow-light">Empecemos por tu institución</p><h2>Cuéntanos qué quieres lograr.</h2><p>Para preparar el diagnóstico, indícanos la ciudad, los grados, cuántos estudiantes participarían y qué equipos o materiales ya tienen. Así podemos plantear un primer proyecto para tu colegio.</p><Link href="/proyectos" className="text-link-light">Explorar proyectos <ArrowRight size={17} /></Link></div>
        <LeadForm program="Robótica" />
      </section>
      <section className="section page-width">
        <div className="section-heading">
          <h2>Libros de Plan lector para colegios</h2>
          <p>Alesya Ediciones ofrece literatura infantil y juvenil y textos escolares. Consulta los <Link className="underlined-link" href="/plan-lector#plan-lector-30-estudiantes">títulos por grado y la ficha para 30 estudiantes</Link>.</p>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
