import { useState, useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Tag, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
          <ScenarioRow
            key={sc.id}
            scenario={sc}
            onToggle={(enabled) => updateScenario.mutate({ id: sc.id, patch: { enabled } })}
            onSaveFinalTag={(final_tag, final_tag_delay_hours) =>
              updateScenario.mutate({ id: sc.id, patch: { final_tag, final_tag_delay_hours } })
            }
            saving={updateScenario.isPending}
          />
        ))}
      </Accordion>
    </div>
  );
}

function ScenarioRow({
  scenario,
  onToggle,
  onSaveFinalTag,
  saving,
}: {
  scenario: IgreenScenario;
  onToggle: (enabled: boolean) => void;
  onSaveFinalTag: (final_tag: string | null, final_tag_delay_hours: number) => void;
  saving: boolean;
}) {
  const [tag, setTag] = useState(scenario.final_tag ?? "");
  const [hours, setHours] = useState<number>(scenario.final_tag_delay_hours ?? 24);

  useEffect(() => {
    setTag(scenario.final_tag ?? "");
    setHours(scenario.final_tag_delay_hours ?? 24);
  }, [scenario.final_tag, scenario.final_tag_delay_hours]);

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
            {scenario.final_tag && (
              <Badge variant="outline" className="text-xs gap-1">
                <Tag className="h-3 w-3" /> {scenario.final_tag} · {scenario.final_tag_delay_hours}h
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <Switch
          checked={scenario.enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <AccordionContent className="px-4 pb-4 space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Tag final do cenário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Após o contato concluir o último dia deste cenário (e o tempo de espera abaixo),
              esta tag será automaticamente adicionada ao contato — útil para acionar outra
              automação. Deixe em branco para não aplicar nenhuma tag.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Tag a aplicar</Label>
                <Input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="ex: CENARIO1_FIM"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aguardar (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <Button
                size="sm"
                onClick={() =>
                  onSaveFinalTag(tag.trim() ? tag.trim() : null, hours)
                }
                disabled={saving}
                className="gap-2"
              >
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
        <ScenarioDaysEditor scenarioId={scenario.id} />
      </AccordionContent>
    </AccordionItem>
  );
}