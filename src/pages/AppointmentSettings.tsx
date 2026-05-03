import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentSettingsTab } from "@/components/settings/AppointmentSettingsTab";

export default function AppointmentSettings() {
  return (
    <DashboardLayout title="Configurar Agendamentos" description="Configure seus serviços, dias e horários de atendimento">
      <AppointmentSettingsTab />
    </DashboardLayout>
  );
}