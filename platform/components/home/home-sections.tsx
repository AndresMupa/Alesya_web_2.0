/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ImmersiveHero } from "@/components/immersive-hero";
import { ImageSlider } from "@/components/home/image-slider";
import { LeadForm } from "@/components/lead-form";
import { ProductCard } from "@/components/store/product-card";
import type { StoreProduct } from "@/lib/commerce/catalog";
import { homeIcon } from "@/lib/pages/icons";
import { paragraphs, type HomeDocument, type HomeSection, type SectionOf } from "@/lib/pages/home-schema";

const pad = (index: number) => String(index).padStart(2, "0");
const videoType = (src: string) => (src.endsWith(".webm") ? "video/webm" : "video/mp4");

/** Video en bucle si lo hay; si no, la imagen; si no hay nada, nada. */
function Media({ video, image, alt = "" }: { video: string; image: string; alt?: string }) {
  if (video) return <video autoPlay muted loop playsInline preload="metadata" poster={image || undefined} aria-hidden="true"><source src={video} type={videoType(video)} /></video>;
  if (image) return <img src={image} alt={alt} loading="lazy" />;
  return null;
}

/** Título en dos líneas: la segunda (acento) va en cursiva y color. */
const Title = ({ title, accent, as: Tag = "h2" }: { title: string; accent?: string; as?: "h2" | "h3" }) => <Tag>{title}{accent && <><br /><em>{accent}</em></>}</Tag>;
const Paragraphs = ({ text, className }: { text: string; className?: string }) => <>{paragraphs(text).map((line, index) => <p key={index} className={className}>{line}</p>)}</>;

/** Dibuja la portada a partir del documento editable (ver lib/pages/home-schema.ts). Las secciones ocultas no se muestran. */
export function HomeSections({ document, featured }: { document: HomeDocument; featured: StoreProduct[] }) {
  return <>{document.sections.filter((section) => section.enabled).map((section) => <Section key={section.id} section={section} featured={featured} />)}</>;
}

function Section({ section, featured }: { section: HomeSection; featured: StoreProduct[] }) {
  switch (section.type) {
    case "hero": return <ImmersiveHero captionTop={section.captionTop} captionBottom={section.captionBottom} poster={section.poster} slides={section.slides} />;
    case "band": return <Band section={section} />;
    case "categories": return <Categories section={section} />;
    case "story": return <Story section={section} />;
    case "paths": return <Paths section={section} />;
    case "store": return <Store section={section} featured={featured} />;
    case "clients": return <Clients section={section} />;
    case "institutional": return <Institutional section={section} />;
    case "banner": return <Banner section={section} />;
    case "slider": return <Slider section={section} />;
    case "text": return <Text section={section} />;
    case "gallery": return <Gallery section={section} />;
  }
}

function Band({ section }: { section: SectionOf<"band"> }) {
  const phrases = section.phrases.filter(Boolean);
  if (!phrases.length) return null;
  return <div className="maker-band">{phrases.map((phrase, index) => index === phrases.length - 1 ? <strong key={index}>{phrase} <Sparkles size={19} /></strong> : <span key={index}>{phrase}</span>)}</div>;
}

function Categories({ section }: { section: SectionOf<"categories"> }) {
  return <section className="section page-width" id="explorar">
    <div className="section-heading split-heading">
      <div>{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}<Title title={section.title} accent={section.accent} /></div>
      {section.intro && <p>{section.intro}</p>}
    </div>
    <div className="category-grid">
      {section.items.map((item, index) => {
        const Icon = homeIcon(item.icon);
        return <Link href={item.href || "/proyectos"} className="category-card" key={item.id} style={{ "--card-accent": item.color || "#d7ff43" } as React.CSSProperties}>
          <span className="category-number">{pad(index + 1)}</span><Icon size={29} strokeWidth={1.7} /><h3>{item.title}</h3><p>{item.copy}</p><span className="round-arrow"><ArrowRight size={17} /></span>
        </Link>;
      })}
    </div>
  </section>;
}

function Story({ section }: { section: SectionOf<"story"> }) {
  return <section className="feature-story">
    <div className="feature-story-media"><Media video={section.video} image={section.image} /></div>
    <div className="feature-story-copy">
      {section.eyebrow && <p className="eyebrow eyebrow-light">{section.eyebrow}</p>}{section.kicker && <p className="story-index">{section.kicker}</p>}
      <h2>{section.title}</h2>
      <Paragraphs text={section.text} />
      {section.meta.length > 0 && <div className="story-meta">{section.meta.map((item) => <span key={item.id}><b>{item.label}</b> {item.value}</span>)}</div>}
      {section.linkLabel && <Link href={section.linkHref || "/proyectos"} className="text-link-light">{section.linkLabel} <ArrowRight size={17} /></Link>}
    </div>
  </section>;
}

function Paths({ section }: { section: SectionOf<"paths"> }) {
  return <section className="section page-width">
    <div className="section-heading split-heading"><div>{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}<h2>{section.title}</h2></div>{section.linkLabel && <Link href={section.linkHref || "/proyectos"} className="underlined-link">{section.linkLabel}</Link>}</div>
    <div className="path-list">
      {section.items.map((path, index) => <Link href={path.href || "/proyectos"} className="path-row" key={path.id}><span className="path-index">{pad(index + 1)}</span><span className="path-title">{path.title}</span><span className="path-detail">{path.detail}</span><span className="path-level">{path.level}</span><ArrowRight size={22} /></Link>)}
    </div>
  </section>;
}

function Store({ section, featured }: { section: SectionOf<"store">; featured: StoreProduct[] }) {
  const products = featured.slice(0, section.limit);
  return <section className="commerce-section">
    <div className="page-width">
      <div className="section-heading split-heading"><div>{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}<h2>{section.title}</h2></div>{section.intro && <p>{section.intro}</p>}</div>
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.slug} product={product} />)}</div> : section.emptyText && <p className="store-coming">{section.emptyText}</p>}
      {section.buttonLabel && <Link href={section.buttonHref || "/catalogo"} className="button button-dark centered-button">{section.buttonLabel}</Link>}
    </div>
  </section>;
}

function Clients({ section }: { section: SectionOf<"clients"> }) {
  const logos = section.logos.filter((logo) => logo.image);
  const photos = section.photos.filter((photo) => photo.image);
  return <section className="clients-section page-width" id="clientes">
    <div className="clients-intro">
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <h2>{section.title}</h2>
      {section.intro && <p>{section.intro}</p>}
      {section.audiences.length > 0 && <div className="client-types">
        {section.audiences.map((audience) => { const Icon = homeIcon(audience.icon); return <div key={audience.id}><Icon /><span><b>{audience.title}</b><small>{audience.text}</small></span></div>; })}
      </div>}
      {logos.length > 0 && <>
        {section.logosTitle && <p className="clients-logos-title">{section.logosTitle}</p>}
        <div className="clients-logos">{logos.map((logo) => <img key={logo.id} src={logo.image} alt={logo.name} title={logo.name} loading="lazy" width={72} height={72} />)}</div>
      </>}
    </div>
    {photos.length > 0 && <div className="clients-gallery">
      {photos.map((photo, index) => <figure className={`client-photo ${index === 0 ? "client-photo-wide" : "client-photo-tall"}`} key={photo.id}><img src={photo.image} alt={photo.alt} loading="lazy" />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}
    </div>}
  </section>;
}

function Institutional({ section }: { section: SectionOf<"institutional"> }) {
  return <section className={`institutional page-width${section.showForm ? "" : " institutional-no-form"}`} id="instituciones">
    <div className="institutional-copy">
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <Title title={section.title} accent={section.accent} />
      <Paragraphs text={section.intro} />
      {section.bullets.length > 0 && <ul>{section.bullets.map((bullet) => { const Icon = homeIcon(bullet.icon); return <li key={bullet.id}><Icon /> {bullet.text}</li>; })}</ul>}
    </div>
    <div className="institutional-media"><Media video={section.video} image={section.image} /></div>
    {section.showForm && <LeadForm />}
  </section>;
}

function Banner({ section }: { section: SectionOf<"banner"> }) {
  return <section className={`home-banner page-width is-${section.theme} layout-${section.layout}`}>
    <div className="home-banner-media"><Media video={section.video} image={section.image} /></div>
    <div className="home-banner-copy">
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <Title title={section.title} accent={section.accent} />
      <Paragraphs text={section.text} />
      {section.buttonLabel && <Link href={section.buttonHref || "/"} className="button">{section.buttonLabel} <ArrowRight size={17} /></Link>}
    </div>
  </section>;
}

function Slider({ section }: { section: SectionOf<"slider"> }) {
  const slides = section.slides.filter((slide) => slide.image);
  if (!slides.length) return null;
  return <section className="section page-width home-slider-section">
    {(section.eyebrow || section.title || section.intro) && <div className="section-heading split-heading"><div>{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}{section.title && <h2>{section.title}</h2>}</div>{section.intro && <p>{section.intro}</p>}</div>}
    <ImageSlider slides={slides} autoplay={section.autoplay} label={section.title || "Galería"} />
  </section>;
}

function Text({ section }: { section: SectionOf<"text"> }) {
  return <section className="section page-width">
    <div className={`home-text align-${section.align}`}>
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <Title title={section.title} accent={section.accent} />
      <div className="home-text-body"><Paragraphs text={section.body} /></div>
      {section.buttonLabel && <Link href={section.buttonHref || "/"} className="button button-dark">{section.buttonLabel}</Link>}
    </div>
  </section>;
}

function Gallery({ section }: { section: SectionOf<"gallery"> }) {
  const items = section.items.filter((item) => item.image);
  if (!items.length) return null;
  return <section className="section page-width">
    {(section.eyebrow || section.title) && <div className="section-heading">{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}{section.title && <h2>{section.title}</h2>}</div>}
    <div className="home-gallery" style={{ "--columns": section.columns } as React.CSSProperties}>
      {items.map((item) => <figure className="home-gallery-item" key={item.id}><img src={item.image} alt={item.caption} loading="lazy" />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}
    </div>
  </section>;
}
