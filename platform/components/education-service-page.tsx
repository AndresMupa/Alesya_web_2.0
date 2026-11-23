import Link from "next/link";
import { QuoteLeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { educationServices } from "@/lib/education-services";
import { absoluteUrl, jsonLd, site, siteUrl } from "@/lib/site";

type EducationService = (typeof educationServices)[keyof typeof educationServices];

export function EducationServicePage({ service }: { service: EducationService }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    url: absoluteUrl(service.path),
    provider: { "@id": `${siteUrl()}/#organizacion`, name: site.publisher },
    areaServed: { "@type": "Country", name: "Colombia" },
  };

  return <div className="site-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <div className="interior-header"><SiteHeader /></div>
    <main>
      <section className="page-hero education-service-hero">
        <div className="page-width">
          <h1>{service.title}</h1>
          <p>{service.description} {service.audience}</p>
          <div className="schools-actions"><a className="button button-primary" href="#cotizar">Solicitar cotización</a></div>
        </div>
      </section>
      <section className="section page-width" aria-labelledby="alcance-servicio">
        <div className="section-heading"><h2 id="alcance-servicio">Qué puedes consultar</h2></div>
        <div className="schools-steps education-grid">
          {service.items.map(({ title, text }) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="schools-conversion quote-section page-width" id="cotizar">
        <div><h2>Cotiza con Alesya</h2><p>{service.brief}</p><Link className="text-link-light" href={service.related.path}>{service.related.label}</Link></div>
        <QuoteLeadForm program={service.program} />
      </section>
    </main>
    <SiteFooter />
  </div>;
}
