import { DashboardLayout } from "@/components/DashboardLayout";
import { FollowupTab } from "@/components/followup/FollowupTab";

export default function Followup() {
  return (
    <DashboardLayout
      title="Follow-Up"
      description="Configure e acompanhe a reativação automática de contatos inativos."
    >
      <FollowupTab />
    </DashboardLayout>
  );
}
