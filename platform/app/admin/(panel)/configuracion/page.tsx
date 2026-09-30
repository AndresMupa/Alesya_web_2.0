import { requireAdmin } from "@/lib/admin-auth";
import { PageHeader } from "@/components/admin/kit";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requireAdmin();
  return <>
    <PageHeader title="Configuración" description="WhatsApp, instrucciones de pago, envío y correo de avisos de la tienda." />
    <SettingsForm />
  </>;
}
