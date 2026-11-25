import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, MessageCircle } from "lucide-react";
import { ForgetAccessButton } from "@/components/english/access-controls";
import { CodeForm } from "@/components/english/code-form";
import { LevelLibrary } from "@/components/english/level-library";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getEnglishAccess, gradeUnlocked } from "@/lib/english/access";
import { GRADES, gradeFromSlug, levelOf, resourceTypes, RESOURCE_TYPES, SAMPLE_NOTICE, type ResourceType } from "@/lib/english/levels";
import { getLevel, listPublishedResources } from "@/lib/english/resources";
import { pageMetadata } from "@/lib/seo";
import { jsonLd, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/ingles/[grado]">) {
  const grade = gradeFromSlug((await params).grado);
  if (!grade) return {};
  const level = await getLevel(grade).catch(() => levelOf(grade));
  return pageMetadata({ title: `Inglés ${level.ordinal} de primaria: libro, audios y actividades`, description: `${level.description} Material del libro de inglés Alesya para ${level.name.toLowerCase()} de primaria, organizado por unidades.`, path: `/ingles/${level.slug}` });
}

const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

export default async function EnglishLevelPage({ params, searchParams }: PageProps<"/ingles/[grado]">) {
  const grade = gradeFromSlug((await params).grado);
  // Entrada desde el QR del libro (las URL antiguas /grado-N/ redirigen con ?desde=qr).
  const fromQr = (await searchParams).desde === "qr";
  if (!grade) notFound();
  const [level, resources, access] = await Promise.all([
    getLevel(grade).catch(() => levelOf(grade)),
    listPublishedResources(grade).catch((error) => { console.error("english_resources_failed", error); return null; }),
    getEnglishAccess().catch(() => null),
  ]);
  // Versión de muestra: todo abierto sin código. Si no se pudo leer el grado de la base, levelOf ya trae "sample".
  const sample = level.accessMode === "sample";
  const unlocked = gradeUnlocked(grade, level.accessMode, access);
  const counts = Object.fromEntries(RESOURCE_TYPES.map((type) => [type, resources?.filter((item) => item.type === type).length ?? 0])) as Record<ResourceType, number>;
  const course = {
    "@context": "https://schema.org", "@type": "Course", name: `Inglés ${level.ordinal} de primaria`, description: level.description, inLanguage: "en", educationalLevel: `${level.name} de primaria`,
    provider: { "@id": `${siteUrl()}/#organizacion` }, url: `${siteUrl()}/ingles/${level.slug}`, isAccessibleForFree: sample,
  };

  return <div className="site-shell english-site" data-tone={level.tone}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(course) }} />
    <div className="interior-header is-solid"><SiteHeader /></div>
    <main>
      <section className="eng-level-hero" data-tone={level.tone}>
        <div className="page-width eng-level-hero-grid">
          <div>
            <nav className="eng-crumbs" aria-label="Ruta"><Link href="/ingles"><ArrowLeft size={15} aria-hidden="true" /> Área de Inglés</Link><span aria-hidden="true">/</span><span aria-current="page">Grado {level.ordinal}</span></nav>
            <p className="eng-level-kicker">{level.name} de primaria{sample && <span className="eng-sample-tag">{SAMPLE_NOTICE.title}</span>}</p>
            <h1><span className="eng-level-big">{level.ordinal}</span><em>{level.tagline}</em></h1>
            <p className="eng-level-lead">{level.description}</p>
            <ul className="eng-level-stats">{RESOURCE_TYPES.map((type) => { const Icon = resourceTypes[type].icon; return <li key={type}><Icon size={16} aria-hidden="true" /><b>{counts[type]}</b> {resourceTypes[type].plural.toLowerCase()}</li>; })}</ul>
          </div>
          <aside className={sample ? "eng-access-card is-sample" : unlocked ? "eng-access-card is-open" : "eng-access-card"} aria-label="Acceso al material">
            {sample ? <>
              <Eye size={28} aria-hidden="true" />
              <p className="eng-sample-label">{SAMPLE_NOTICE.title}</p>
              <p>{fromQr ? `Entraste con el QR de tu libro de ${level.ordinal}. ` : ""}{SAMPLE_NOTICE.text}</p>
              <a className="button button-dark" href="#material">Ir al material</a>
            </> : unlocked ? <>
              <CheckCircle2 size={30} aria-hidden="true" />
              <h2>Material desbloqueado</h2>
              <p>Tienes acceso completo a {level.ordinal} en este equipo{access?.expiresAt ? ` hasta el ${dateFormat.format(access.expiresAt)}` : ""}.</p>
              <a className="button button-dark" href="#material">Ir al material</a>
              <ForgetAccessButton />
            </> : <>
              <h2>Desbloquea todo el material</h2>
              <p>{fromQr ? `Entraste con el QR de tu libro de ${level.ordinal}. Escribe el código que viene en el libro para abrir el material.` : `Escribe el código de tu libro de ${level.ordinal}. Mientras tanto puedes ver la lista y abrir las muestras gratis.`}</p>
              <CodeForm grade={grade} tone="light" autoFocus={fromQr} />
            </>}
          </aside>
        </div>
      </section>

      <nav className="eng-switch" aria-label="Cambiar de grado"><div className="page-width">
        <span>Grados</span>
        {GRADES.map((item) => <Link key={item} href={`/ingles/grado-${item}`} aria-current={item === grade ? "page" : undefined} data-tone={levelOf(item).tone} className={item === grade ? "is-active" : undefined}>{item}°{!sample && access?.grades.has(item) && <CheckCircle2 size={12} aria-label="desbloqueado" />}</Link>)}
      </div></nav>

      <section className="section page-width eng-material" id="material">
        <div className="section-heading split-heading"><div><p className="eyebrow">Material de {level.ordinal}</p><h2>Unidad por unidad.</h2></div><p>{sample ? "Versión de muestra: elige el tipo de material o recorre las unidades en orden." : unlocked ? "Elige el tipo de material o recorre las unidades en orden." : "Los recursos con candado se abren con tu código; las muestras gratis puedes abrirlas ya."}</p></div>
        {resources ? <LevelLibrary resources={resources} unlocked={unlocked} grade={grade} ordinal={level.ordinal} /> : <p className="checkout-status">No pudimos cargar el material en este momento. Recarga la página en unos segundos.</p>}
      </section>

      {!sample && <section className="eng-help page-width">
        <div><h2>¿Problemas con tu código?</h2><p>Escríbenos con una foto de la primera página de tu libro y te ayudamos a entrar.</p></div>
        <a className="button button-dark" href={`https://wa.me/573005937840?text=${encodeURIComponent(`Hola, necesito ayuda con el código del Área de Inglés de ${level.ordinal}.`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true" /> Pedir ayuda por WhatsApp</a>
      </section>}
    </main>
    <SiteFooter />
  </div>;
}
