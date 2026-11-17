import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, jsonLd, site, organizationJsonLd } from "@/lib/site";

export const dynamic = "force-dynamic";
const title = "Capacitación en ChatGPT Business en Colombia";
const description = "Capacitación práctica en ChatGPT Business para empresas y colegios en Colombia. Prueba un proceso real con Alesya y mide tiempo, calidad y correcciones.";
export const generateMetadata = () => pageMetadata({ title, description, path: "/chatgpt-business" });
const questions = [
  { question: "¿Para qué equipos sirve la capacitación?", answer: "Para equipos administrativos, comerciales y editoriales, y para docentes y coordinadores que quieren aplicar ChatGPT a un proceso concreto con fuentes propias y revisión humana." },
  { question: "¿Qué recibe el equipo al terminar el piloto?", answer: "La propuesta contempla una plantilla de instrucciones, criterios para revisar los borradores y una comparación con el proceso habitual. El diagnóstico acuerda qué entregables se preparan para el caso elegido." },
  { question: "¿Incluye licencias de ChatGPT Business?", answer: "La propuesta de acompañamiento se cotiza por separado de la suscripción a OpenAI. Si tu organización ya tiene un espacio de trabajo, revisamos primero las funciones disponibles en ese espacio." },
  { question: "¿Cuánto cuesta y cuánto dura la capacitación?", answer: "La cotización y el calendario se preparan según el número de participantes, el proceso que se quiere mejorar y el acompañamiento que necesita el equipo. Comparte esos datos para recibir una propuesta." },
];
export default function ChatGPTBusinessPage() {
  const url = absoluteUrl("/chatgpt-business");
  const whatsapp = "https://wa.me/573005937840?text=" + encodeURIComponent("Hola, quiero explorar un piloto de formación en ChatGPT Business para mi organización. Vengo de /chatgpt-business.");
  const structured = [...organizationJsonLd(),
    { "@context": "https://schema.org", "@type": "Service", name: title, description, url, serviceType: "Capacitación y acompañamiento en ChatGPT Business", provider: { "@id": absoluteUrl("/#organizacion") }, areaServed: { "@type": "Country", name: "Colombia" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "ChatGPT Business", item: url }] },
  ];
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
    <main className="legal-page page-width">
      <article className="legal-article">
        <p className="eyebrow">Alesya · Formación para equipos</p>
        <h1>{title}</h1>
        <p>Alesya Ediciones ofrece capacitación y acompañamiento en ChatGPT Business para empresas y colegios en Colombia. El piloto se centra en una tarea real del equipo: preparar una propuesta comercial, revisar un borrador editorial o planear una clase. Los participantes practican con fuentes autorizadas, revisan los resultados y miden si el nuevo proceso les sirve.</p>
        <p><a className="underlined-link" href="#contacto">Solicitar una propuesta de capacitación</a></p>
        <section id="aplicaciones"><h2>Casos de uso para empresas y colegios</h2><ul>
          <li><strong>Planeación docente:</strong> preparar una secuencia de actividades a partir del objetivo de aprendizaje, el grado y los materiales disponibles.</li>
          <li><strong>Producción de contenidos:</strong> preparar borradores de guías y rúbricas que el docente o editor verifica antes de usar.</li>
          <li><strong>Gestión comercial:</strong> convertir un catálogo vigente y una solicitud en un borrador de propuesta, señalando datos pendientes y sin inventar precios.</li>
        </ul></section>
        <section id="piloto">
          <h2>Cómo funciona la capacitación</h2>
          <ol>
            <li><strong>Diagnóstico.</strong> Elegimos una tarea, documentamos el flujo actual y acordamos qué fuentes se pueden usar y quién revisará el resultado.</li>
            <li><strong>Práctica guiada.</strong> El equipo prepara una plantilla que especifica los datos de entrada, el formato esperado y qué hacer si falta información.</li>
            <li><strong>Evaluación.</strong> Aplicamos los mismos criterios a ejemplos comparables. Registramos el tiempo de preparación y revisión, los datos que hubo que corregir y los casos que conviene escalar a una persona.</li>
          </ol>
          <p>El diagnóstico define entregables, responsables, duración y honorarios. La contratación de licencias se trata por separado.</p>
        </section>
        <section id="ejemplo-comercial">
          <h2>Ejemplo de piloto para un equipo comercial</h2>
          <p>Una empresa quiere responder más rápido a solicitudes de cotización. El equipo prepara dos borradores para una misma solicitud de prueba: uno con su proceso habitual y otro con ChatGPT Business, una ficha de producto autorizada y el catálogo vigente.</p>
          <p>La plantilla pide un resumen de la solicitud, los productos que corresponden y una lista de datos sin confirmar. Si faltan precios, existencias o fechas de entrega, el borrador los deja pendientes para revisión. La persona responsable valida esas condiciones antes de enviar la propuesta.</p>
          <p>Para decidir si adoptar el flujo, compara el tiempo total de preparación y revisión, cuántos datos hubo que corregir y si los pendientes quedaron claros. Es un ejercicio de muestra para el piloto.</p>
        </section>
        <section><h2>Ejemplo: una actividad de robótica con fuentes del colegio</h2><p>El docente entrega la guía del kit disponible, el objetivo curricular y el tiempo de clase. ChatGPT prepara un borrador con materiales, pasos, preguntas y criterios de evaluación. El docente comprueba que las piezas existen y que el reto corresponde al grupo antes de llevarlo al aula.</p><p>Este ejemplo es un uso propuesto; no representa un resultado medido ni un caso de cliente.</p><p>Conoce también los <Link href="/colegios">programas de robótica para colegios</Link> y nuestros <Link href="/proyectos">proyectos educativos</Link>.</p></section>
        <section><h2>Preguntas frecuentes</h2>{questions.map(({ question, answer }) => <section key={question}><h3>{question}</h3><p>{answer}</p></section>)}</section>
        <section id="contacto"><h2>Solicitar una propuesta para tu equipo</h2><p>Para cotizar la capacitación, indícanos la ciudad, el número de participantes y la tarea que quieren mejorar. Si ya tienen un espacio de trabajo de ChatGPT, cuéntanos cuál utilizan.</p><p><a className="underlined-link" href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar la capacitación por WhatsApp</a></p><p>También puedes escribir a <a href={"mailto:" + site.email + "?subject=Piloto%20ChatGPT%20Business"}>{site.email}</a>.</p></section>
        <section><h2>Documentación del producto</h2><p>La disponibilidad de herramientas depende del plan y de la configuración del espacio. Consulta la <a href="https://learn.chatgpt.com/docs/enterprise/work-admin-faq">documentación oficial de administración</a> y la <a href="https://learn.chatgpt.com/docs/get-started-with-work">guía de ChatGPT Work</a>.</p><p>ChatGPT es un producto de OpenAI. Esta propuesta de Alesya es independiente y no implica afiliación, certificación ni representación de OpenAI.</p></section>
      </article>
      <aside className="legal-aside"><p className="eyebrow">En esta página</p><nav aria-label="Contenido"><ul><li><a href="#aplicaciones">Casos de uso</a></li><li><a href="#piloto">El piloto</a></li><li><a href="#ejemplo-comercial">Ejemplo comercial</a></li><li><a href="#contacto">Solicitar propuesta</a></li></ul></nav></aside>
    </main><SiteFooter /></div>;
}
