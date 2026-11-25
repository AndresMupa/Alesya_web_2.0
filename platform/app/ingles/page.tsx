import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, GraduationCap, KeyRound, Lock, MessageCircle, MousePointerClick, School } from "lucide-react";
import { CodeDialogButton, ForgetAccessButton } from "@/components/english/access-controls";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getEnglishAccess } from "@/lib/english/access";
import { resourceTypes, RESOURCE_TYPES, SAMPLE_NOTICE } from "@/lib/english/levels";
import { listLevels, type LevelSummary } from "@/lib/english/resources";
import { pageMetadata } from "@/lib/seo";
import { jsonLd, siteUrl } from "@/lib/site";

// Dinámica: el acceso depende de la cookie del visitante y el canónico del dominio de PRODUCTION_URL.
export const dynamic = "force-dynamic";

const description = "Área de Inglés de Alesya Ediciones: libros digitales, audios, videos y actividades de inglés para primaria, organizados por grado de 1° a 5°. Desbloquea tu material con el código de tu libro.";
export const generateMetadata = () => pageMetadata({ title: "Área de Inglés: material de 1° a 5° de primaria", description, path: "/ingles" });

const whatsapp = "https://wa.me/573005937840?text=Hola%2C%20soy%20docente%20y%20quiero%20c%C3%B3digos%20del%20%C3%81rea%20de%20Ingl%C3%A9s%20para%20mi%20colegio.";

const faqs = [
  { q: "¿Dónde encuentro mi código?", a: "En la primera página de tu libro de inglés Alesya. Si el libro lo compró el colegio, pídeselo a tu docente: el colegio recibe los códigos de cada curso." },
  { q: "¿Tengo que crear una cuenta?", a: "No. Escribes el código una vez y queda guardado en ese navegador. En otro equipo o celular solo tienes que escribirlo de nuevo." },
  { q: "¿Puedo usar el material en el celular?", a: "Sí. Los libros se abren en el lector del teléfono, los audios se escuchan en la misma página y las actividades se pueden descargar para imprimir." },
  { q: "Mi código no funciona, ¿qué hago?", a: "Revisa que esté completo (letras y números, sin espacios). Si ya venció o alcanzó su límite de usos, escríbenos por WhatsApp con una foto del libro y te ayudamos." },
  { q: "Soy docente, ¿cómo obtengo códigos para mi curso?", a: "Escríbenos por WhatsApp o desde la página de colegios. Preparamos códigos por curso y grado, con la vigencia del año escolar." },
];

const faqJsonLd = () => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) });
const listJsonLd = (levels: LevelSummary[]) => ({
  "@context": "https://schema.org", "@type": "ItemList", name: "Área de Inglés por grado",
  itemListElement: levels.map((level, index) => ({ "@type": "ListItem", position: index + 1, url: `${siteUrl()}/ingles/${level.slug}`, name: `Inglés ${level.ordinal} de primaria` })),
});

export default async function EnglishLandingPage() {
  const [levels, access] = await Promise.all([
    listLevels().catch((error) => { console.error("english_levels_failed", error); return null; }),
    getEnglishAccess().catch(() => null),
  ]);
  const unlocked = [...(access?.grades ?? [])].sort();
  return <div className="site-shell english-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([faqJsonLd(), ...(levels ? [listJsonLd(levels)] : [])]) }} />
    <div className="interior-header is-solid"><SiteHeader /></div>
    <main>
      <section className="eng-hero">
        <div className="page-width eng-hero-grid">
          <div className="eng-hero-copy">
            <p className="eyebrow eyebrow-light">Alesya Ediciones · Área de Inglés</p>
            <h1>Learn English,<br /><em>grado a grado.</em></h1>
            <p className="eng-hero-lead">Tu libro de inglés, ahora con todo su material en línea: el libro digital, los audios de cada unidad, videos y actividades para practicar en casa y en clase.</p>
            <div className="eng-hero-actions">
              <a className="button button-primary" href="#grados">Elegir mi grado <ArrowRight size={17} aria-hidden="true" /></a>
              <CodeDialogButton />
            </div>
            {unlocked.length > 0 && <p className="eng-hero-access"><CheckCircle2 size={17} aria-hidden="true" /> Tienes acceso a {unlocked.length === 5 ? "todos los grados" : unlocked.map((grade) => `${grade}°`).join(", ")} en este equipo. <ForgetAccessButton className="eng-link-button is-light" /></p>}
          </div>
          <div className="eng-hero-art" aria-hidden="true">
            {(levels ?? []).map((level) => <span key={level.grade} className="eng-hero-tile" data-tone={level.tone}><b>{level.ordinal}</b><small>{level.tagline}</small></span>)}
          </div>
        </div>
      </section>

      <section className="section page-width" id="grados">
        <div className="section-heading split-heading"><div><p className="eyebrow">Elige tu nivel</p><h2>Un camino para cada grado.</h2></div><p>Cada grado sigue las unidades de su libro. Entra al tuyo para ver el material; con el código de tu libro se abre todo.</p></div>
        {levels ? <div className="eng-levels">
          {levels.map((level) => {
            const sample = level.accessMode === "sample";
            const open = !sample && access?.grades.has(level.grade);
            return <Link key={level.grade} href={`/ingles/${level.slug}`} className="eng-level-card" data-tone={level.tone}>
              <span className="eng-level-top"><b className="eng-level-ordinal">{level.ordinal}</b><span className={sample ? "eng-chip is-sample" : open ? "eng-chip is-open" : "eng-chip"}>{sample ? <><Eye size={13} aria-hidden="true" /> {SAMPLE_NOTICE.title}</> : open ? <><CheckCircle2 size={13} aria-hidden="true" /> Desbloqueado</> : <><Lock size={13} aria-hidden="true" /> Con código</>}</span></span>
              <span className="eng-level-name">{level.name} de primaria</span>
              <em className="eng-level-tagline">{level.tagline}</em>
              <span className="eng-level-desc">{level.description}</span>
              <span className="eng-level-counts">{level.total ? RESOURCE_TYPES.filter((type) => level.counts[type]).map((type) => { const Icon = resourceTypes[type].icon; return <span key={type}><Icon size={14} aria-hidden="true" />{level.counts[type]} {(level.counts[type] === 1 ? resourceTypes[type].label : resourceTypes[type].plural).toLowerCase()}</span>; }) : <span>Material en preparación</span>}</span>
              <span className="eng-level-go">Entrar a {level.ordinal} <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>;
          })}
        </div> : <p className="checkout-status">No pudimos cargar los grados en este momento. Recarga la página en unos segundos.</p>}
      </section>

      <section className="eng-how">
        <div className="page-width">
          <div className="section-heading"><p className="eyebrow">Así funciona</p><h2>Tres pasos y a practicar.</h2></div>
          <ol className="eng-steps">
            <li><span>01</span><MousePointerClick size={26} aria-hidden="true" /><h3>Elige tu grado</h3><p>Entra al grado de tu libro: de 1° a 5° de primaria.</p></li>
            <li><span>02</span><KeyRound size={26} aria-hidden="true" /><h3>Escribe tu código</h3><p>Está en tu libro o te lo da tu colegio. Solo una vez por equipo.</p></li>
            <li><span>03</span><GraduationCap size={26} aria-hidden="true" /><h3>Aprende a tu ritmo</h3><p>Lee, escucha, mira y practica cada unidad cuando quieras.</p></li>
          </ol>
        </div>
      </section>

      <section className="section page-width">
        <div className="section-heading split-heading"><div><p className="eyebrow">En cada grado</p><h2>Todo el material de tu libro, en un solo lugar.</h2></div><p>Organizado por unidades, igual que tu libro, para que siempre sepas qué sigue.</p></div>
        <div className="eng-types">
          {RESOURCE_TYPES.map((type) => { const meta = resourceTypes[type]; const Icon = meta.icon; return <article key={type} className={`eng-type is-${type}`}><span aria-hidden="true"><Icon size={26} /></span><h3>{meta.plural}</h3><p>{meta.hint}</p></article>; })}
        </div>
      </section>

      <section className="eng-teachers page-width">
        <div><p className="eyebrow eyebrow-light">Para docentes y colegios</p><h2>Códigos para todo tu curso.</h2><p>Preparamos códigos por curso y grado, con la vigencia del año escolar, para que tus estudiantes usen el material en clase y en casa.</p></div>
        <div className="eng-teachers-actions">
          <a className="button button-primary" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true" /> Pedir códigos por WhatsApp</a>
          <Link className="button button-ghost-light" href="/colegios#diagnostico"><School size={17} aria-hidden="true" /> Programa para colegios</Link>
        </div>
      </section>

      <section className="section page-width eng-faq">
        <div className="section-heading"><p className="eyebrow">Preguntas frecuentes</p><h2>¿Dudas? Aquí te ayudamos.</h2></div>
        <div className="eng-faq-list">{faqs.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
