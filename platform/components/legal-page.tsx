import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLegalPage, legalPages } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const legalMetadata = (slug: string) => {
  const page = getLegalPage(slug);
  return page ? pageMetadata({ title: page.title, description: page.description, path: `/${page.slug}`, type: "article" }) : {};
};

/** Página legal: título, fecha de actualización, secciones y enlaces a las demás políticas. */
export function LegalPageView({ slug }: { slug: string }) {
  const page = getLegalPage(slug);
  if (!page) notFound();
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <main className="legal-page page-width">
      <article className="legal-article">
        <p className="eyebrow">Información legal</p>
        <h1>{page.title}</h1>
        <p className="legal-updated">Actualizada el {page.updated}</p>
        {page.blocks.map((block, index) => <section key={index}>
          {block.heading && <h2>{block.heading}</h2>}
          {block.paragraphs?.map((text, position) => <p key={position}>{text}</p>)}
          {block.items && <ul>{block.items.map((item, position) => <li key={position}>{item}</li>)}</ul>}
        </section>)}
      </article>
      <aside className="legal-aside" aria-label="Otras políticas">
        <p className="eyebrow">Otras políticas</p>
        <ul>{legalPages.map((item) => <li key={item.slug}>{item.slug === page.slug ? <strong aria-current="page">{item.short}</strong> : <Link href={`/${item.slug}`}>{item.short}</Link>}</li>)}</ul>
      </aside>
    </main>
    <SiteFooter />
  </div>;
}
