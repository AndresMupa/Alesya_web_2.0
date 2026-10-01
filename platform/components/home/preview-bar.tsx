import Link from "next/link";
import { Eye } from "lucide-react";

/** Barra que solo ve el equipo cuando abre la portada con `?vista=borrador`. */
export function PreviewBar() {
  return <div className="preview-bar" role="status">
    <span><Eye size={16} /> <strong>Vista previa del borrador.</strong> Así se verá la portada cuando la publiques; el público sigue viendo la versión publicada.</span>
    <span><Link href="/admin/portada">Volver al editor</Link><Link href="/">Ver la publicada</Link></span>
  </div>;
}
