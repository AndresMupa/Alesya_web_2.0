import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Boxes,
  CircuitBoard,
  GraduationCap,
  Printer,
  School,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";

import { LeadForm } from "@/components/lead-form";
import { ImmersiveHero } from "@/components/immersive-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/store/product-card";
import { getFeaturedProducts, type StoreProduct } from "@/lib/commerce/catalog";
import { learningPaths } from "@/lib/content";

export const dynamic = "force-dynamic";

const categories = [
  { icon: Bot, title: "LEGO EV3", copy: "Retos de construcción, sensores, motores y programación por bloques.", color: "var(--signal-yellow)" },
  { icon: Boxes, title: "LEGO WeDo", copy: "Primeros pasos en mecanismos y pensamiento computacional para primaria.", color: "var(--signal-cyan)" },
  { icon: CircuitBoard, title: "Arduino", copy: "Electrónica aplicada con microcontroladores, sensores y proyectos reales.", color: "var(--signal-lime)" },
  { icon: Wrench, title: "Bricolaje", copy: "Construye objetos útiles mientras aprendes diseño, medida y fabricación.", color: "var(--signal-coral)" },
  { icon: Printer, title: "Impresión 3D", copy: "Modelado, prototipado y piezas que conectan las ideas con el mundo físico.", color: "var(--signal-violet)" },
];

/** Colegios que ya trabajan con Alesya (logos en /public/media/clientes). */
const clientSchools = [
  { src: "/media/clientes/lideres-del-manana.png", name: "Gimnasio Líderes del Mañana" },
  { src: "/media/clientes/colegio-finlandes.png", name: "Colegio Finlandés Juan Pablo II" },
  { src: "/media/clientes/meryland.png", name: "Nuevo Gimnasio Campestre Meryland Bilingüe" },
  { src: "/media/clientes/la-anunciacion.png", name: "Instituto La Anunciación" },
  { src: "/media/clientes/mayor-andino.jpg", name: "Colegio Mayor Andino" },
  { src: "/media/clientes/alcibiades-florez.jpg", name: "Gimnasio Alcibíades Flórez" },
  { src: "/media/clientes/ninos-felices.png", name: "Colegio Niños Felices" },
  { src: "/media/clientes/gs.jpg", name: "Institución aliada" },
];

async function loadFeatured(): Promise<StoreProduct[]> {
  try { return await getFeaturedProducts(4); } catch (error) { console.error("home_featured_failed", error); return []; }
}

export default async function Home() {
  const featured = await loadFeatured();
  return (
    <div className="site-shell immersive-home">
      <SiteHeader />
      <main>
        <ImmersiveHero />
        <div className="maker-band"><span>Para mentes curiosas.</span><span>Para manos inquietas.</span><strong>Para quienes crean el futuro. <Sparkles size={19} /></strong></div>

        <section className="section page-width" id="explorar">
          <div className="section-heading split-heading">
            <div><p className="eyebrow">Encuentra tu próxima aventura</p><h2>¿Qué quieres<br /><em>crear hoy?</em></h2></div>
            <p>Empieza con una curiosidad. Encuentra el proyecto, aprende a tu ritmo y descubre hasta dónde puedes llegar.</p>
          </div>
          <div className="category-grid">
            {categories.map(({ icon: Icon, title, copy, color }, index) => (
              <Link href={`/proyectos?categoria=${encodeURIComponent(title)}`} className="category-card" key={title} style={{ "--card-accent": color } as React.CSSProperties}>
                <span className="category-number">0{index + 1}</span><Icon size={29} strokeWidth={1.7} /><h3>{title}</h3><p>{copy}</p><span className="round-arrow"><ArrowRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="feature-story">
          <div className="feature-story-media"><video autoPlay muted loop playsInline preload="metadata" aria-hidden="true"><source src="/media/lego-ev3.mp4" type="video/mp4" /></video></div>
          <div className="feature-story-copy">
            <p className="eyebrow eyebrow-light">Proyecto destacado</p><p className="story-index">01 / 04</p>
            <h2>Programa un robot que entiende su entorno.</h2>
            <p>Del primer mecanismo al desafío autónomo: una ruta EV3 con guías docentes, actividades de aula y piezas listas para construir.</p>
            <div className="story-meta"><span><b>Edad</b> 10–16 años</span><span><b>Duración</b> 6 sesiones</span><span><b>Nivel</b> Intermedio</span></div>
            <Link href="/proyectos" className="text-link-light">Ver ruta completa <ArrowRight size={17} /></Link>
          </div>
        </section>

        <section className="section page-width">
          <div className="section-heading split-heading"><div><p className="eyebrow">Rutas de aprendizaje</p><h2>De la curiosidad a la creación.</h2></div><Link href="/proyectos" className="underlined-link">Ver todas las rutas</Link></div>
          <div className="path-list">
            {learningPaths.map((path, index) => <Link href="/proyectos" className="path-row" key={path.title}><span className="path-index">0{index + 1}</span><span className="path-title">{path.title}</span><span className="path-detail">{path.detail}</span><span className="path-level">{path.level}</span><ArrowRight size={22} /></Link>)}
          </div>
        </section>

        <section className="commerce-section">
          <div className="page-width">
            <div className="section-heading split-heading"><div><p className="eyebrow">Tienda educativa</p><h2>Todo para empezar a construir.</h2></div><p>Productos seleccionados por su valor pedagógico, no solo por sus especificaciones.</p></div>
            {featured.length ? <div className="product-grid">{featured.map((product) => <ProductCard key={product.slug} product={product} />)}</div> : <p className="store-coming">Estamos preparando el catálogo en línea. Escríbenos y te ayudamos a elegir.</p>}
            <Link href="/catalogo" className="button button-dark centered-button">Ver catálogo completo</Link>
          </div>
        </section>

        <section className="clients-section page-width" id="clientes">
          <div className="clients-intro">
            <p className="eyebrow">Nuestros clientes</p>
            <h2>La tecnología cobra sentido cuando llega a una comunidad.</h2>
            <p>En el aula, en casa o en comunidad. Acompañamos a quienes descubren, enseñan y comparten una nueva forma de aprender.</p>
            <div className="client-types">
              <div><School /><span><b>Colegios y academias</b><small>Programas, laboratorios y dotación.</small></span></div>
              <div><GraduationCap /><span><b>Docentes y formadores</b><small>Rutas, libros y acompañamiento.</small></span></div>
              <div><UsersRound /><span><b>Familias y estudiantes</b><small>Kits y proyectos para aprender haciendo.</small></span></div>
              <div><Sparkles /><span><b>Fundaciones y aliados</b><small>Proyectos de impacto y cobertura.</small></span></div>
            </div>
            <p className="clients-logos-title">Colegios que confían en Alesya</p>
            <div className="clients-logos">
              {/* eslint-disable-next-line @next/next/no-img-element -- logos pequeños y estáticos */}
              {clientSchools.map((school) => <img key={school.src} src={school.src} alt={school.name} title={school.name} loading="lazy" width={72} height={72} />)}
            </div>
          </div>
          <div className="clients-gallery">
            <figure className="client-photo client-photo-wide"><img src="/media/clientes-robotica-ev3.jpeg" alt="Estudiantes presentando proyectos de robótica educativa" /><figcaption>Robótica que se demuestra, se comparte y se celebra.</figcaption></figure>
            <figure className="client-photo client-photo-tall"><img src="/media/clientes-lego-wedo.jpeg" alt="Estudiante construyendo un proyecto con LEGO WeDo" /><figcaption>Aprendizaje activo desde los primeros mecanismos.</figcaption></figure>
          </div>
        </section>

        <section className="institutional page-width" id="instituciones">
          <div className="institutional-copy"><p className="eyebrow">Para colegios y organizaciones</p><h2>No entregamos cajas.<br /><em>Construimos capacidad.</em></h2><p>Diseñamos programas de robótica y cultura maker con diagnóstico, dotación, formación docente, contenidos y seguimiento.</p><ul><li><ShieldCheck /> Implementación acompañada</li><li><GraduationCap /> Formación para docentes</li><li><Sparkles /> Proyectos adaptados al contexto</li></ul></div>
          <div className="institutional-media"><video autoPlay muted loop playsInline preload="metadata" aria-hidden="true"><source src="/media/impresion-3d.mp4" type="video/mp4" /></video></div>
          <LeadForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
