import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata } from "@/lib/seo";
import { jsonLd, site, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
const description = "Plan lector de Alesya Ediciones para colegios en Colombia. Consulta la ficha para 30 estudiantes con Igor el Robot, textos escolares por grado y cotización de ejemplares.";
export const generateMetadata = () => pageMetadata({ title: "Plan lector para colegios en Colombia", description, path: "/plan-lector" });

export default function ReadingPlanPage() {
  const whatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero consultar el plan lector y la selección editorial para mi colegio.");
  const quoteWhatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero cotizar Plan lector para 30 estudiantes. Colegio: __. Ciudad: __. Grado: __. Títulos de interés: __. Fecha requerida: __.");
  return <div className="site-shell schools-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "Service", name: "Plan lector para colegios", description, url: siteUrl() + "/plan-lector", provider: { "@id": siteUrl() + "/#organizacion" }, areaServed: { "@type": "Country", name: "Colombia" } }) }} />
    <div className="interior-header"><SiteHeader /></div>
    <main>
      <section className="page-hero schools-hero"><div className="page-width">
        <p className="eyebrow eyebrow-light">Alesya Ediciones · Literatura y educación</p>
        <h1>Plan lector para<br />tu colegio.</h1>
        <p>Alesya Ediciones es una editorial colombiana con sede en Funza, Cundinamarca. Publicamos literatura, cuentos y libros escolares, y ofrecemos plan lector para instituciones educativas.</p>
        <div className="schools-actions">
          <a href="#plan-lector-30-estudiantes" className="button button-primary">Ver ficha para 30 estudiantes</a>
          <a href={whatsapp} className="button button-ghost-light" target="_blank" rel="noopener noreferrer">Consultar el plan lector</a>
          <Link href="/catalogo?categoria=Libros" className="button button-ghost-light">Ver libros disponibles en tienda</Link>
        </div>
      </div></section>
      <section className="section page-width schools-roster" id="plan-lector-30-estudiantes" aria-labelledby="plan-lector-30-titulo">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">Ficha para colegios</p><h2 id="plan-lector-30-titulo">Plan lector para 30 estudiantes</h2></div>
          <p>Para un curso de 30 estudiantes, puedes consultar por 30 ejemplares de un mismo título, uno por estudiante. Si el colegio prefiere combinar títulos o compartir ejemplares, indica las cantidades por título al pedir la cotización.</p>
        </div>
        <div className="schools-steps schools-roster-grid">
          <article>
            <h3>Igor el Robot</h3>
            <p>Cuento ilustrado de Mario Andrés López Zuluaga, de la colección Apapache de Alesya Ediciones.</p>
            <p><strong>Grado recomendado:</strong> preescolar, para lectura en voz alta. <strong>ISBN de la edición impresa:</strong> 978-628-96589-7-2.</p>
          </article>
          <article>
            <h3>Robótica Educativa · Módulo Prejardín</h3>
            <p>Texto escolar complementario de Alesya Ediciones.</p>
            <p><strong>Grado recomendado:</strong> prejardín.</p>
          </article>
          <article>
            <h3>Robótica Educativa · Módulo Jardín</h3>
            <p>Texto escolar complementario con actividades de secuencias y recorridos.</p>
            <p><strong>Grado recomendado:</strong> jardín.</p>
          </article>
        </div>
        <div className="schools-roster-quote">
          <h3>Qué se define al cotizar</h3>
          <ul>
            <li>Selección por grado, edición e ISBN cuando esté disponible.</li>
            <li>Número de ejemplares por título, disponibilidad, precio unitario y total.</li>
            <li>Costo y fecha estimada de entrega en el municipio del colegio y condiciones de pago.</li>
          </ul>
          <a href={quoteWhatsapp} className="button button-primary" target="_blank" rel="noopener noreferrer">Cotizar Plan lector para 30 estudiantes</a>
        </div>
      </section>
      <section className="section page-width schools-program">
        <div className="section-heading"><p className="eyebrow">Selección editorial</p><h2>Una conversación sobre lo que tu comunidad quiere leer.</h2><p>El plan lector forma parte de nuestra línea editorial, junto con los libros escolares, la literatura y los cuentos. Para conocer títulos, disponibilidad y condiciones, consulta directamente con el equipo de Alesya.</p></div>
        <div className="schools-steps">
          <article><span>01</span><h3>Comparte el contexto</h3><p>Indícanos el nombre del colegio, los grados y el número aproximado de estudiantes.</p></article>
          <article><span>02</span><h3>Cuéntanos tus objetivos</h3><p>Explica los intereses de lectura y el periodo escolar para el que estás buscando libros.</p></article>
          <article><span>03</span><h3>Consulta las opciones</h3><p>Solicita información sobre la selección editorial, las cantidades y las condiciones de entrega.</p></article>
        </div>
      </section>
      <section className="section page-width"><div className="section-heading"><p className="eyebrow">Preguntas frecuentes</p><h2>Antes de elegir los libros.</h2></div>
        <h3>¿Dónde consulto los títulos del plan lector?</h3><p>Contacta al equipo comercial para consultar la oferta editorial vigente. La tienda en línea muestra los productos disponibles allí; consulta por otros títulos y solicitudes institucionales.</p>
        <h3>¿A quién está dirigida esta propuesta?</h3><p>A colegios y equipos docentes que buscan conocer la línea editorial y el plan lector de Alesya Ediciones en Colombia.</p>
        <h3>¿Cómo contacto a Alesya?</h3><p>Escríbenos a <a href={"mailto:" + site.email}>{site.email}</a> o llama al <a href={site.phoneHref}>{site.phone}</a>. Estamos en {site.address.street}, {site.address.city}, {site.address.region}.</p>
      </section>
    </main><SiteFooter />
  </div>;
}
