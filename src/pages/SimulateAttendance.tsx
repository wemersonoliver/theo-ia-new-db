import { DashboardLayout } from "@/components/DashboardLayout";
import { PromptTestTab } from "./AIAgent";

export default function SimulateAttendance() {
  return (
    <DashboardLayout
      title="Simular Atendimento"
      description="Teste o atendimento e ajuste seu assistente em tempo real"
    >
      <PromptTestTab />
    </DashboardLayout>
  );
}