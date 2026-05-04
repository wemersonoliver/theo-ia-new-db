import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Clock, Sparkles } from "lucide-react";
import { AIGeneralTab } from "@/components/ai/AIGeneralTab";
import { AIHoursTab } from "@/components/ai/AIHoursTab";
import { InterviewTab } from "@/components/ai/InterviewTab";

export function AISettingsTab() {
  const [tab, setTab] = useState("general");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
        <TabsTrigger value="general" className="min-w-fit gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          Geral
        </TabsTrigger>
        <TabsTrigger value="hours" className="min-w-fit gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Horários
        </TabsTrigger>
        <TabsTrigger value="interview" className="min-w-fit gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Entrevista IA
        </TabsTrigger>
      </TabsList>
      <TabsContent value="general"><AIGeneralTab /></TabsContent>
      <TabsContent value="hours"><AIHoursTab /></TabsContent>
      <TabsContent value="interview"><InterviewTab onPromptApplied={() => setTab("general")} /></TabsContent>
    </Tabs>
  );
}