import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuoteLeadForm } from "@/components/lead-form";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, jsonLd, site, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
const path = "/plan-lector";
const title = "Plan lector por grado para colegios en Colombia";
const description = "Alesya Ediciones, proveedor de libros de plan lector para colegios en Colombia. Consulta títulos por grado, autores e ISBN y cotiza ejemplares para 30 estudiantes.";
export const generateMetadata = () => pageMetadata({ title, description, path });

const childrenAuthor = "Mario Andrés López Zuluaga";
const schoolAuthor = "Richard Daza Rodríguez";

const literature = [
  { title: "Igor el Robot", authors: [childrenAuthor], grade: "Preescolar, para lectura en voz alta", isbn: "978-628-96589-7-2", record: 505487 },
  { title: "Fotón ¿De qué color es tu luz?", authors: [childrenAuthor], grade: "1.º a 3.º de primaria", isbn: "978-628-96589-8-9", record: 505492 },
  { title: "Cuentos Desilustrados", authors: [childrenAuthor, "Yeimy Maricela Arango Escobar"], grade: "2.º a 4.º de primaria", isbn: "978-628-97783-0-4", record: 508829 },
  { title: "Hugo el Huevo", authors: [childrenAuthor], grade: "3.º a 5.º de primaria", isbn: "978-628-96589-9-6", record: 505489 },
  { title: "Pasajeros", authors: ["Andrés Henao Flórez"], grade: "Secundaria, para adolescentes. Validar el grado con el colegio", isbn: "978-628-96155-1-7", record: 446061 },
];

const primaryReaders = [
  { title: "Lectores y punto primero", grade: "1.º", isbn: "978-628-96155-6-2", record: 458103 },
  { title: "Lectores y punto segundo", grade: "2.º", isbn: "978-628-96589-2-7", record: 459256 },
  { title: "Lectores y punto tercero", grade: "3.º", isbn: "978-628-96589-6-5", record: 459257 },
  { title: "Lectores y punto cuarto", grade: "4.º", isbn: "978-628-96589-4-1", record: 459258 },
  { title: "Lectores y punto quinto", grade: "5.º", isbn: "978-628-96589-5-8", record: 459259 },
].map((book) => ({ ...book, authors: [schoolAuthor], grade: `${book.grade} de primaria` }));

function isbnRecordUrl(record: number) {
  return `https://isbn.camlibro.com.co/catalogo.php?mode=detalle&nt=${record}`;
}

function BookTable({ books, labelledBy }: { books: typeof literature; labelledBy: string }) {
  return <div className="reading-plan-table" role="region" aria-labelledby={labelledBy} tabIndex={0}>
    <table aria-labelledby={labelledBy}>
      <thead><tr><th scope="col">Grado recomendado</th><th scope="col">Título</th><th scope="col">Autoría</th><th scope="col">ISBN</th></tr></thead>
      <tbody>
        {books.map((book) => (
          <tr key={book.isbn} id={`libro-${book.isbn}`}>
            <td>{book.grade}</td>
            <th scope="row">{book.title}</th>
            <td>{book.authors.join(" y ")}</td>
            <td><a className="underlined-link" href={isbnRecordUrl(book.record)}
              aria-label={`ISBN ${book.isbn} en el registro de la Cámara Colombiana del Libro`}>{book.isbn}</a></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

export default function ReadingPlanPage() {
  const whatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero consultar el plan lector y la selección editorial para mi colegio.");
  const quoteWhatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero cotizar Plan lector para 30 estudiantes. Colegio: __. Ciudad: __. Grado: __. Títulos de interés: __. Fecha requerida: __.");
  const url = absoluteUrl(path);
  const publisher = { "@id": `${siteUrl()}/#organizacion`, name: site.publisher };
  const catalog = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Service", name: title, description, url, provider: publisher, areaServed: { "@type": "Country", name: "Colombia" } },
      {
        "@type": "ItemList",
        name: "Libros de Alesya Ediciones para Plan lector por grado",
        url: `${url}#plan-lector-30-estudiantes`,
        itemListElement: [...literature, ...primaryReaders].map((book, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Book",
            name: book.title,
            url: `${url}#libro-${book.isbn}`,
            author: book.authors.map((name) => ({ "@type": "Person", name })),
            publisher,
            isbn: book.isbn,
            sameAs: isbnRecordUrl(book.record),
            audience: { "@type": "EducationalAudience", educationalRole: "estudiante" },
            description: `Grado recomendado: ${book.grade}.`,
          },
        })),
      },
    ],
  };
  return <div className="site-shell schools-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(catalog) }} />
    <div className="interior-header"><SiteHeader /></div>
    <main>
      <section className="page-hero schools-hero"><div className="page-width">
        <p className="eyebrow eyebrow-light">Alesya Ediciones · Literatura y educación</p>
        <h1>{title}</h1>
        <p>Alesya Ediciones es una editorial y proveedora de libros de plan lector para colegios en Colombia, con sede en Funza, Cundinamarca. El catálogo reúne cuentos para preescolar y primaria, la serie <em>Lectores y punto</em> de 1.º a 5.º y literatura juvenil para secundaria.</p>
        <div className="schools-actions">
          <a href="#plan-lector-30-estudiantes" className="button button-primary">Ver ficha para 30 estudiantes</a>
          <a href={whatsapp} className="button button-ghost-light" target="_blank" rel="noopener noreferrer">Consultar el plan lector</a>
          <Link href="/catalogo?categoria=Libros" className="button button-ghost-light">Ver libros disponibles en tienda</Link>
        </div>
      </div></section>
      <section className="section page-width schools-roster" id="plan-lector-30-estudiantes" aria-labelledby="plan-lector-30-titulo">
        <div className="section-heading split-heading">
          <div><h2 id="plan-lector-30-titulo">Plan lector para 30 estudiantes</h2></div>
          <p>Consulta con Alesya Ediciones por 30 ejemplares de un título, uno por estudiante, o por una selección de varios títulos. Indica el grado, el municipio y las cantidades que necesita el colegio. Alesya confirma existencias, precio y plazos al cotizar.</p>
        </div>
        <h3 id="literatura-por-grado">Literatura infantil y juvenil por grado</h3>
        <p>Los grados sugeridos para literatura son orientativos. El colegio puede ajustar la selección al nivel lector del curso. Cada ISBN enlaza al registro de esa edición en la Cámara Colombiana del Libro.</p>
        <BookTable books={literature} labelledBy="literatura-por-grado" />
        <h3 id="lectores-y-punto">Lectores y punto de 1.º a 5.º de primaria</h3>
        <p>La serie de textos escolares de lectura tiene una edición para cada grado de primaria.</p>
        <BookTable books={primaryReaders} labelledBy="lectores-y-punto" />
        <h3>Textos escolares complementarios de preescolar</h3>
        <div className="schools-steps schools-roster-grid">
          <article>
            <h4>Robótica Educativa · Módulo Prejardín</h4>
            <p>Texto escolar de Joan Manuel Parra Cifuentes, publicado por Alesya Ediciones.</p>
            <p><strong>Grado recomendado:</strong> prejardín.</p>
          </article>
          <article>
            <h4>Robótica Educativa · Módulo Jardín</h4>
            <p>Texto escolar de Joan Manuel Parra Cifuentes con actividades de secuencias y recorridos.</p>
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
          <p><a className="underlined-link" href="#cotizar">Solicitar cotización por formulario</a></p>
        </div>
      </section>
      <section className="schools-conversion quote-section page-width" id="cotizar">
        <div><h2>Cotiza Plan lector para tu colegio</h2><p>Indica el municipio, grado, títulos, cantidades y fecha requerida. Alesya confirma existencias, precio y plazos al cotizar.</p></div>
        <QuoteLeadForm program="Plan lector" />
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
        <h3>¿Dónde consulto los títulos del plan lector?</h3><p>La <a className="underlined-link" href="#plan-lector-30-estudiantes">ficha para 30 estudiantes</a> reúne los títulos con su grado recomendado, autoría e ISBN. Para confirmar disponibilidad y cantidades, solicita una cotización al equipo comercial.</p>
        <h3>¿A quién está dirigida esta propuesta?</h3><p>A colegios y equipos docentes que buscan conocer la línea editorial y el plan lector de Alesya Ediciones en Colombia.</p>
        <h3>¿Cómo contacto a Alesya?</h3><p>Escríbenos a <a href={"mailto:" + site.email}>{site.email}</a> o llama al <a href={site.phoneHref}>{site.phone}</a>. Estamos en {site.address.street}, {site.address.city}, {site.address.region}.</p>
      </section>
    </main><SiteFooter />
  </div>;
}
