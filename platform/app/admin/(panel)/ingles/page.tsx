import { requireAdmin } from "@/lib/admin-auth";
import { PageHeader } from "@/components/admin/kit";
import { EnglishManager } from "@/components/admin/english/english-manager";

export const metadata = { title: "Área de Inglés" };

export default async function EnglishAdminPage() {
  await requireAdmin();
  return <>
    <PageHeader title="Área de Inglés" description="Material por grado (libros, audios, videos y actividades) y códigos de acceso para estudiantes y colegios.">
      <a className="refresh-button" href="/ingles" target="_blank" rel="noopener">Ver página pública ↗</a>
    </PageHeader>
    <EnglishManager />
  </>;
}
