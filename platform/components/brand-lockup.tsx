import Link from "next/link";

export function BrandLockup({ operations = false }: { operations?: boolean }) {
  return (
    <Link className="brand-family" href="/" aria-label="Alesya Ediciones y Alesya X-Tech, inicio">
      <span className="brand-ediciones">
        <img src="/media/alesya-ediciones.png" alt="" />
        <span><b>ALESYA</b><small>EDICIONES</small></span>
      </span>
      <span className="brand-divider" aria-hidden="true" />
      <img className="brand-xtech" src="/media/alesya-x-tech.svg" alt="Alesya X-Tech" />
      {operations && <span className="brand-operations">Operaciones</span>}
    </Link>
  );
}
