import { DashboardLayout } from "@/components/DashboardLayout";
import { FollowupTab } from "@/components/followup/FollowupTab";

export default function Followup() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Follow-Up</h1>
          <p className="text-muted-foreground">
            Configure e acompanhe a reativação automática de contatos inativos.
          </p>
        </div>
        <FollowupTab />
      </div>
    </DashboardLayout>
  );
}
