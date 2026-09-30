import { requireAdmin } from "@/lib/admin-auth";
import { LeadsExplorer } from "@/components/admin/crm/leads-explorer";

export const metadata = { title: "CRM" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  await requireAdmin();
  const { lead } = await searchParams;
  return <LeadsExplorer initialLead={lead && /^[0-9a-f-]{36}$/.test(lead) ? lead : undefined} />;
}
