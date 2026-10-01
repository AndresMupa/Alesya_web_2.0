import { requireAdmin } from "@/lib/admin-auth";
import { HomeEditor } from "@/components/admin/pages/home-editor";

export const metadata = { title: "Portada" };

/** Editor de la página de inicio: bloques, textos, imágenes y videos, con borrador, vista previa y publicación. */
export default async function HomePageEditor() {
  await requireAdmin();
  return <HomeEditor />;
}
