import { HomeSections } from "@/components/home/home-sections";
import { PreviewBar } from "@/components/home/preview-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAdmin } from "@/lib/admin-auth";
import { getFeaturedProducts, type StoreProduct } from "@/lib/commerce/catalog";
import { getDraftHome, getPublishedHome } from "@/lib/pages/home";
import { defaultHomeDocument, type HomeDocument, type SectionOf } from "@/lib/pages/home-schema";

export const dynamic = "force-dynamic";

/** El contenido vive en la base (editable en /admin/portada); si no se puede leer, se muestra el diseño original. */
async function loadDocument(preview: boolean): Promise<HomeDocument> {
  try { return preview ? await getDraftHome() : await getPublishedHome(); }
  catch (error) { console.error("home_document_failed", error); return defaultHomeDocument(); }
}

async function loadFeatured(limit: number): Promise<StoreProduct[]> {
  try { return await getFeaturedProducts(limit); } catch (error) { console.error("home_featured_failed", error); return []; }
}

/** Portada. Con `?vista=borrador` y sesión de administrador muestra el borrador del editor en vez de lo publicado. */
export default async function Home({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const preview = vista === "borrador" && !!(await getAdmin());
  const document = await loadDocument(preview);
  const store = document.sections.find((section): section is SectionOf<"store"> => section.type === "store" && section.enabled);
  const featured = store ? await loadFeatured(store.limit) : [];
  return (
    <div className="site-shell immersive-home">
      <SiteHeader />
      <main><HomeSections document={document} featured={featured} /></main>
      <SiteFooter />
      {preview && <PreviewBar />}
    </div>
  );
}
