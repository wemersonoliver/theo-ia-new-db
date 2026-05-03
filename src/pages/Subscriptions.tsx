import { DashboardLayout } from "@/components/DashboardLayout";
import { SubscriptionsTab } from "@/components/settings/SubscriptionsTab";

export default function Subscriptions() {
  return (
    <DashboardLayout title="Assinaturas" description="Gerencie as assinaturas dos clientes via Kiwify">
      <SubscriptionsTab />
    </DashboardLayout>
  );
}