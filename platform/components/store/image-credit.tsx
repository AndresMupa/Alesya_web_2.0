import { imageCredit } from "@/lib/commerce/image-credits";

/**
 * Atribución de una foto con licencia libre (autor, licencia, fuente y cambios). No pinta nada si la foto es propia.
 * Va debajo de la galería de la ficha de producto; no en tarjetas ni carrito.
 */
export function ImageCredit({ src, className }: { src: string | null | undefined; className?: string }) {
  const credit = imageCredit(src);
  if (!credit) return null;
  return <p className={className ? `image-credit ${className}` : "image-credit"}>
    Foto: {credit.author} ·{" "}
    {credit.licenseUrl ? <a href={credit.licenseUrl} target="_blank" rel="license noopener noreferrer">{credit.license}</a> : credit.license} ·{" "}
    <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · {credit.changes}
  </p>;
}
