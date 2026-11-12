import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, jsonLd, site, organizationJsonLd } from "@/lib/site";

export const dynamic = "force-dynamic";
const title = "ChatGPT Business para colegios y equipos de trabajo";
const description = "Explora un piloto de formación y acompañamiento en ChatGPT Business con Alesya: planeación docente, contenidos y procesos de equipo en Colombia.";
export const generateMetadata = () => pageMetadata({ title, description, path: "/chatgpt-business" });
const questions = [
  { question: "¿Para quién es este acompañamiento?", answer: "Para docentes, coordinadores y equipos administrativos o comerciales que quieren probar ChatGPT en tareas concretas, con fuentes propias y revisión de resultados." },
  { question: "¿Qué incluye la propuesta?", answer: "Un diagnóstico del proceso, selección de un caso de uso, formación práctica, plantillas de instrucciones y una evaluación del piloto. El alcance, calendario y honorarios se acuerdan antes de comenzar." },
  { question: "¿Incluye licencias de ChatGPT Business?", answer: "La propuesta de acompañamiento se cotiza por separado de la suscripción a OpenAI. Si tu organización ya tiene un espacio de trabajo, revisamos primero las funciones disponibles en ese espacio." },
  { question: "¿Este servicio mejora la posición de mi web en ChatGPT?", answer: "El uso interno de ChatGPT y la visibilidad pública de una web son trabajos distintos. Este acompañamiento no promete posiciones ni recomendaciones en respuestas de IA." },
];
export default function ChatGPTBusinessPage() {
  const url = absoluteUrl("/chatgpt-business");
  const whatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero explorar un piloto de formación en ChatGPT Business para mi organización. Vengo de /chatgpt-business.");
  const structured = [...organizationJsonLd(),
    { "@context": "https://schema.org", "@type": "Service", name: title, description, url, serviceType: "Formación y acompañamiento en el uso de ChatGPT", provider: { "@id": absoluteUrl("/#organizacion") }, areaServed: { "@type": "Country", name: "Colombia" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "ChatGPT Business", item: url }] },
  ];
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
    <main className="legal-page page-width">
      <article className="legal-article">
        <p className="eyebrow">Alesya · Formación para equipos</p>
        <h1>{title}</h1>
        <p className="legal-updated">Propuesta de piloto · Alesya Ediciones · 12 de noviembre de 2026</p>
        <p>Convierte una tarea repetitiva en un proceso que tu equipo pueda probar, revisar y mejorar. Con Alesya puedes explorar una propuesta de formación y acompañamiento en ChatGPT, adaptada a los recursos y objetivos de tu organización.</p>
        <section id="aplicaciones"><h2>Empezar por una tarea que importe</h2><ul>
          <li><strong>Planeación docente:</strong> preparar una secuencia de actividades a partir del objetivo de aprendizaje, el grado y los materiales disponibles.</li>
          <li><strong>Producción de contenidos:</strong> preparar borradores de guías y rúbricas que el docente o editor verifica antes de usar.</li>
          <li><strong>Gestión comercial:</strong> convertir un catálogo vigente y una solicitud en un borrador de propuesta, señalando datos pendientes y sin inventar precios.</li>
        </ul></section>
        <section id="piloto"><h2>Cómo planteamos el piloto</h2><ul>
          <li>Elegir un proceso y medir cuánto tiempo requiere hoy.</li>
          <li>Revisar el espacio de trabajo existente, las fuentes autorizadas y las personas participantes.</li>
          <li>Practicar con ejemplos del equipo y construir instrucciones reutilizables.</li>
          <li>Comparar tiempo, calidad y correcciones antes de ampliar el uso.</li>
        </ul><p>El diagnóstico define entregables, responsables, duración y honorarios. La contratación de licencias se trata por separado.</p></section>
        <section><h2>Ejemplo: una actividad de robótica con fuentes del colegio</h2><p>El docente entrega la guía del kit disponible, el objetivo curricular y el tiempo de clase. ChatGPT prepara un borrador con materiales, pasos, preguntas y criterios de evaluación. El docente comprueba que las piezas existen y que el reto corresponde al grupo antes de llevarlo al aula.</p><p>Este ejemplo es un uso propuesto; no representa un resultado medido ni un caso de cliente.</p><p>Conoce también los <Link href="/colegios">programas de robótica para colegios</Link> y nuestros <Link href="/proyectos">proyectos educativos</Link>.</p></section>
        <section><h2>Preguntas frecuentes</h2>{questions.map(({ question, answer }) => <section key={question}><h3>{question}</h3><p>{answer}</p></section>)}</section>
        <section id="contacto"><h2>Diseñemos un primer caso de uso</h2><p>Cuéntanos cuántas personas participarían, qué tarea quieren mejorar y si ya tienen ChatGPT Team o Business.</p><p><a className="underlined-link" href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar el piloto por WhatsApp</a></p><p>También puedes escribir a <a href={"mailto:" + site.email + "?subject=Piloto%20ChatGPT%20Business"}>{site.email}</a>.</p></section>
        <section><h2>Documentación del producto</h2><p>La disponibilidad de herramientas depende del plan y de la configuración del espacio. Consulta la <a href="https://learn.chatgpt.com/docs/enterprise/work-admin-faq">documentación oficial de administración</a> y la <a href="https://learn.chatgpt.com/docs/get-started-with-work">guía de ChatGPT Work</a>.</p><p>ChatGPT es un producto de OpenAI. Esta propuesta de Alesya es independiente y no implica afiliación, certificación ni representación de OpenAI.</p></section>
      </article>
      <aside className="legal-aside"><p className="eyebrow">En esta página</p><nav aria-label="Contenido"><ul><li><a href="#aplicaciones">Casos de uso</a></li><li><a href="#piloto">El piloto</a></li><li><a href="#contacto">Solicitar propuesta</a></li></ul></nav></aside>
    </main><SiteFooter /></div>;
}
