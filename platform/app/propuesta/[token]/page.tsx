import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { LiveProposal } from "@/components/proposal/live-proposal";
import { getProposal } from "@/lib/crm/proposal";
import "./proposal.css";

// Fuentes servidas desde el propio dominio (next/font las descarga al compilar): el navegador no llama a Google.
const sans = Geist({ subsets: ["latin"], variable: "--pv-font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--pv-font-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--pv-font-serif", display: "swap" });

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#06080f", colorScheme: "dark" };

type Props = { params: Promise<{ token: string }> };

/** El enlace se comparte por WhatsApp: la vista previa muestra el colegio y la Arena. No se indexa. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const proposal = await getProposal(token).catch(() => null);
  if (!proposal) return { title: "Propuesta", robots: { index: false, follow: false } };
  const title = `Propuesta de Robótica Educativa · ${proposal.organization}`;
  const description = `Ruta por niveles, Arena ALESYA X jugable e inversión calculada para ${proposal.organization}. Propuesta ${proposal.number}.`;
  const image = { url: "/media/propuesta/arena-portada.jpg", width: 1632, height: 1318, alt: "Arena ALESYA X" };
  return {
    title: { absolute: title }, description, robots: { index: false, follow: false },
    openGraph: { type: "website", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/** Propuesta viva: la cotización del CRM presentada como página interactiva, con aceptación en línea y analítica de lectura. */
export default async function ProposalPage({ params }: Props) {
  const { token } = await params;
  const proposal = await getProposal(token).catch((error) => { console.error("proposal_load_failed", error); return null; });
  if (!proposal) notFound();
  return <LiveProposal proposal={proposal} className={`${sans.variable} ${mono.variable} ${serif.variable}`} />;
}
