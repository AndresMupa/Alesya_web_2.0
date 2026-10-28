import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { UnsubscribeForm } from "@/components/unsubscribe-form";
import { getOptOutState } from "@/lib/crm/leads";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
// El enlace es personal: no se indexa ni se sigue.
export const metadata: Metadata = { title: "Baja de comunicaciones", robots: { index: false, follow: false } };

/** Baja de comunicaciones comerciales (`/baja/[token]`). No muestra ningún dato del contacto: el token solo dice si existe y si ya está dado de baja. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getOptOutState(token).catch((error) => { console.error("unsubscribe_load_failed", error); return null; });
  if (!state) notFound();
  return <div className="site-shell"><div className="interior-header is-solid"><SiteHeader /></div>
    <main className="baja-page page-width">
      <p className="eyebrow">{site.name}</p>
      <h1>Comunicaciones comerciales</h1>
      <UnsubscribeForm token={token} optedOut={state.optedOut} />
    </main>
    <SiteFooter />
  </div>;
}
