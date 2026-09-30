import Link from "next/link";
import { ArrowRight, GraduationCap, School, ShieldCheck, Sparkles } from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Programas de robótica para colegios | Alesya",
  description: "Diagnóstico, dotación, formación docente y rutas de proyectos para implementar robótica y cultura maker en colegios de Colombia.",
};

const whatsapp = "https://wa.me/573005937840?text=Hola%2C%20quiero%20conocer%20el%20programa%20de%20rob%C3%B3tica%20para%20mi%20colegio.%20Vengo%20de%20la%20p%C3%A1gina%20de%20colegios.";

export default function SchoolsPage() {
  return <div className="site-shell schools-page">
    <div className="interior-header"><SiteHeader /></div>
    <main>
      <section className="page-hero schools-hero"><div className="page-width">
        <p className="eyebrow eyebrow-light">Alesya para instituciones educativas</p>
        <h1>Robótica para<br />todo el colegio.</h1>
        <p>Diseñamos contigo una implementación por grados: recursos, proyectos y acompañamiento docente en una sola ruta.</p>
        <div className="schools-actions"><a className="button button-primary" href="#diagnostico">Solicitar diagnóstico <ArrowRight size={17} /></a><a className="button button-ghost-light" href={whatsapp} target="_blank" rel="noopener noreferrer">Conversar por WhatsApp</a></div>
      </div></section>
      <section className="section page-width schools-program">
        <div className="section-heading split-heading"><div><p className="eyebrow">De la idea al aula</p><h2>Una ruta para toda la comunidad educativa.</h2></div><p>La propuesta se ajusta al número de estudiantes, grados, recursos existentes y objetivos pedagógicos de cada institución.</p></div>
        <div className="schools-steps">
          <article><School /><span>01</span><h3>Diagnóstico</h3><p>Conversamos sobre grados, cobertura y metas del colegio.</p></article>
          <article><Sparkles /><span>02</span><h3>Ruta pedagógica</h3><p>Definimos proyectos y contenidos adecuados para cada etapa.</p></article>
          <article><GraduationCap /><span>03</span><h3>Formación</h3><p>Acompañamos a los docentes para llevar la ruta al aula.</p></article>
          <article><ShieldCheck /><span>04</span><h3>Implementación</h3><p>Articulamos materiales, actividades y seguimiento.</p></article>
        </div>
      </section>
      <section className="schools-conversion page-width" id="diagnostico">
        <div><p className="eyebrow eyebrow-light">Empecemos por tu institución</p><h2>Cuéntanos qué quieres lograr.</h2><p>Déjanos los datos de tu colegio y el reto que buscas resolver. El equipo comercial podrá preparar una conversación enfocada en tu contexto.</p><Link href="/proyectos" className="text-link-light">Explorar proyectos <ArrowRight size={17} /></Link></div>
        <LeadForm />
      </section>
    </main>
    <SiteFooter />
  </div>;
}
