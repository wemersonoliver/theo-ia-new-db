import { DashboardLayout } from "@/components/DashboardLayout";
import { FollowupTab } from "@/components/followup/FollowupTab";
import { CustomFollowupTab } from "@/components/followup/CustomFollowupTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Workflow } from "lucide-react";

export default function Followup() {
  return (
    <DashboardLayout
      title="Follow-Up"
      description="Reative contatos inativos com IA ou crie fluxos personalizados de mensagens."
    >
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai" className="gap-2"><Bot className="h-4 w-4" /> Follow-Up IA</TabsTrigger>
          <TabsTrigger value="custom" className="gap-2"><Workflow className="h-4 w-4" /> Fluxos Personalizados</TabsTrigger>
        </TabsList>
        <TabsContent value="ai"><FollowupTab /></TabsContent>
        <TabsContent value="custom"><CustomFollowupTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
