import { LegalPageView, legalMetadata } from "@/components/legal-page";

// Dinámica para que el enlace canónico use el dominio de PRODUCTION_URL del servidor (no el del momento de compilar).
export const dynamic = "force-dynamic";
export const generateMetadata = () => legalMetadata("politica-de-privacidad");

export default function Page() {
  return <LegalPageView slug="politica-de-privacidad" />;
}
