import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { useIgreenScenarios, type IgreenScenario } from "@/hooks/useIgreenScenarios";
import { ScenarioDaysEditor } from "./ScenarioDaysEditor";

export function IgreenScenariosTab() {
  const { scenariosQ, updateScenario } = useIgreenScenarios();

  if (scenariosQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const scenarios = scenariosQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Cenários Igreen Energy
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cada cenário é acionado quando a tag <b>CENARIO1</b>, <b>CENARIO2</b> ou <b>CENARIO3</b> é
          adicionada ao contato. Estrutura padrão: 7 dias × 2 envios/dia (manhã 08:00–12:00, tarde
          12:00–19:55, com intervalo mínimo de 3h). Cada envio é uma sequência de itens
          (texto/áudio/vídeo/imagem/documento) com atraso configurável entre eles. O cenário é
          interrompido automaticamente quando o contato responde.
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="space-y-3">
        {scenarios.map((sc) => (
          <ScenarioRow key={sc.id} scenario={sc} onToggle={(enabled) =>
            updateScenario.mutate({ id: sc.id, patch: { enabled } })
          } />
        ))}
      </Accordion>
    </div>
  );
}

function ScenarioRow({
  scenario,
  onToggle,
}: {
  scenario: IgreenScenario;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <AccordionItem value={scenario.id} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 px-4">
        <AccordionTrigger className="flex-1 hover:no-underline">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono">{scenario.scenario_key}</Badge>
            <span className="font-medium">{scenario.name}</span>
            {!scenario.enabled && (
              <Badge variant="secondary" className="text-xs">Desativado</Badge>
            )}
          </div>
        </AccordionTrigger>
        <Switch
          checked={scenario.enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <AccordionContent className="px-4 pb-4">
        <ScenarioDaysEditor scenarioId={scenario.id} />
      </AccordionContent>
    </AccordionItem>
  );
}