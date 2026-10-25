import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { faqs } from "@/lib/faq";
import { pageMetadata } from "@/lib/seo";
import { jsonLd } from "@/lib/site";

// Dinámica para que el enlace canónico use el dominio de PRODUCTION_URL del servidor (no el del momento de compilar).
export const dynamic = "force-dynamic";

const title = "Preguntas frecuentes sobre robótica educativa";
const description = "Respuestas sobre kits de robótica LEGO, Arduino, impresión 3D, envíos a toda Colombia, formas de pago, programas para colegios y devoluciones de Alesya X-Tech.";

export const generateMetadata = () => pageMetadata({ title, description, path: "/preguntas-frecuentes", type: "article" });

/** Las respuestas van como texto visible en la página y también en el dato estructurado FAQPage. */
const faqJsonLd = () => ({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
});

export default function FaqPage() {
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd()) }} />
    <main className="legal-page page-width">
      <article className="legal-article">
        <p className="eyebrow">Ayuda</p>
        <h1>Preguntas frecuentes</h1>
        <p className="legal-updated">{description}</p>
        {faqs.map((faq) => <section key={faq.question}>
          <h2>{faq.question}</h2>
          <p>{faq.answer}</p>
        </section>)}
        <section>
          <h2>¿Otra pregunta?</h2>
          <p>Escríbenos por WhatsApp o visita la <Link href="/catalogo">tienda</Link> para encontrar el kit adecuado para tu proyecto.</p>
        </section>
      </article>
    </main>
    <SiteFooter />
  </div>;
}
