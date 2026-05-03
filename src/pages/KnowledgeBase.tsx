import { DashboardLayout } from "@/components/DashboardLayout";
import { KnowledgeBaseTab } from "@/components/settings/KnowledgeBaseTab";

export default function KnowledgeBase() {
  return (
    <DashboardLayout title="Base de Conhecimento" description="Carregue documentos para o agente IA usar nas respostas">
      <KnowledgeBaseTab />
    </DashboardLayout>
  );
}