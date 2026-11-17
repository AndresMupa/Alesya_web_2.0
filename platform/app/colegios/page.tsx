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
        <div className="schools-actions"><a className="button button-primary" href="#diagnostico">Solicitar diagnóstico <ArrowRight size={17} /></a><a className="button button-ghost-light" href={whatsapp} target="_blank" rel="noopener noreferrer">Conversar por WhatsApp</a></div>
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
      <section className="schools-conversion page-width" id="diagnostico">
        <div><p className="eyebrow eyebrow-light">Empecemos por tu institución</p><h2>Cuéntanos qué quieres lograr.</h2><p>Para preparar el diagnóstico, indícanos la ciudad, los grados, cuántos estudiantes participarían y qué equipos o materiales ya tienen. Así podemos plantear un primer proyecto para tu colegio.</p><Link href="/proyectos" className="text-link-light">Explorar proyectos <ArrowRight size={17} /></Link></div>
        <LeadForm program="Robótica" />
      </section>
    </main>
    <SiteFooter />
  </div>;
}
