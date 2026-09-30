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
import { featuredProducts, learningPaths } from "@/lib/catalog";

const categories = [
  { icon: Bot, title: "LEGO EV3", copy: "Retos de construcción, sensores, motores y programación por bloques.", color: "var(--signal-yellow)" },
  { icon: Boxes, title: "LEGO WeDo", copy: "Primeros pasos en mecanismos y pensamiento computacional para primaria.", color: "var(--signal-cyan)" },
  { icon: CircuitBoard, title: "Arduino", copy: "Electrónica aplicada con microcontroladores, sensores y proyectos reales.", color: "var(--signal-lime)" },
  { icon: Wrench, title: "Bricolaje", copy: "Construye objetos útiles mientras aprendes diseño, medida y fabricación.", color: "var(--signal-coral)" },
  { icon: Printer, title: "Impresión 3D", copy: "Modelado, prototipado y piezas que conectan las ideas con el mundo físico.", color: "var(--signal-violet)" },
];

export default function Home() {
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
            <div className="product-grid">
              {featuredProducts.map((product) => <article className="product-card" key={product.slug}><div className="product-visual" data-tone={product.tone}><product.icon size={76} strokeWidth={1.15} />{product.badge && <span>{product.badge}</span>}</div><div className="product-copy"><p className="product-type">{product.type}</p><h3>{product.name}</h3><p>{product.description}</p><div className="product-footer"><strong>{product.price}</strong><Link href={`/checkout?producto=${product.slug}`} aria-label={`Comprar ${product.name}`}><ArrowRight size={19} /></Link></div></div></article>)}
            </div>
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
