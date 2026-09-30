import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { BrandLockup } from "@/components/brand-lockup";
import { adminConfigured, getAdmin } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso administrativo | Alesya", robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return <main className="login-page"><section className="login-story"><BrandLockup /><div><p className="eyebrow">ALESYA EDICIONES · X-TECH</p><h2>Detrás de cada<br />gran experiencia,<br /><em>estás tú.</em></h2><p>Conecta ideas. Acompaña comunidades.<br />Haz que el aprendizaje suceda.</p></div><Link href="/">← Volver a la experiencia</Link></section><section className="login-surface"><AdminLogin configured={adminConfigured()} /></section></main>;
}
