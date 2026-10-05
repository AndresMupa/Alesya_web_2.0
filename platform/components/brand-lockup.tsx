/* eslint-disable @next/next/no-img-element -- logos pequeños ya optimizados (scripts/optimize-media.mjs); en cPanel no hay optimizador de imágenes. */
import Link from "next/link";

/** Logo doble Alesya Ediciones · Alesya X-Tech. Los archivos pesan ~6 KB (el vectorial original vive en Recursos/). */
export function BrandLockup({ operations = false }: { operations?: boolean }) {
  return (
    <Link className="brand-family" href="/" aria-label="Alesya Ediciones y Alesya X-Tech, inicio">
      <span className="brand-ediciones">
        <img src="/media/alesya-ediciones.png" alt="" width={34} height={30} decoding="async" />
        <span><b>ALESYA</b><small>EDICIONES</small></span>
      </span>
      <span className="brand-divider" aria-hidden="true" />
      <img className="brand-xtech" src="/media/alesya-x-tech.webp" alt="Alesya X-Tech" width={49} height={50} decoding="async" />
      {operations && <span className="brand-operations">Operaciones</span>}
    </Link>
  );
}
