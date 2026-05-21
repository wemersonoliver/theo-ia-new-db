import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Tag, Save, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useIgreenScenarios, type IgreenScenario, type IgreenProduct, type ProductKey } from "@/hooks/useIgreenScenarios";
import { ScenarioDaysEditor } from "./ScenarioDaysEditor";

export function IgreenScenariosTab() {
  const { scenariosQ, productsQ, updateScenario, createScenario, deleteScenario } = useIgreenScenarios();

  if (scenariosQ.isLoading || productsQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const scenarios = scenariosQ.data ?? [];
  const products = productsQ.data ?? [];
  const firstProduct = products[0]?.key ?? "green";

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
          Organize seus cenários por <b>produto</b>. Em cada produto você pode criar quantos
          cenários quiser e definir uma <b>tag de gatilho</b> personalizada — quando essa tag for
          adicionada ao contato, o cenário correspondente é iniciado. Estrutura padrão de cada
          cenário: dias com 2 envios (manhã 08:00–12:00 e tarde 12:00–19:55). Sequências são
          interrompidas automaticamente quando o contato responde.
        </CardContent>
      </Card>

      <Tabs defaultValue={firstProduct} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {products.map((p) => {
            const count = scenarios.filter((s) => s.product_key === p.key).length;
            return (
              <TabsTrigger key={p.key} value={p.key} className="gap-2">
                {p.name}
                <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {products.map((p) => (
          <TabsContent key={p.key} value={p.key} className="space-y-3">
            <ProductPanel
              product={p}
              scenarios={scenarios.filter((s) => s.product_key === p.key)}
              onCreate={(name, trigger_tag) =>
                createScenario.mutate({ product_key: p.key, name, trigger_tag })
              }
              onToggle={(id, enabled) => updateScenario.mutate({ id, patch: { enabled } })}
              onUpdate={(id, patch) => updateScenario.mutate({ id, patch })}
              onDelete={(id) => deleteScenario.mutate(id)}
              saving={updateScenario.isPending || createScenario.isPending}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProductPanel({
  product,
  scenarios,
  onCreate,
  onToggle,
  onUpdate,
  onDelete,
  saving,
}: {
  product: IgreenProduct;
  scenarios: IgreenScenario[];
  onCreate: (name: string, trigger_tag: string | null) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onUpdate: (id: string, patch: Partial<IgreenScenario>) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newTag.trim() || null);
    setNewName("");
    setNewTag("");
  };

  return (
    <div className="space-y-3">
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo cenário em {product.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Nome do cenário</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Lead frio – Green"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tag de gatilho (opcional)</Label>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="ex: LEAD_FRIO_GREEN"
              />
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim() || saving} className="gap-2">
              <Plus className="h-4 w-4" /> Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {scenarios.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
          Nenhum cenário em {product.name} ainda. Crie o primeiro acima.
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-3">
          {scenarios.map((sc) => (
            <ScenarioRow
              key={sc.id}
              scenario={sc}
              onToggle={(enabled) => onToggle(sc.id, enabled)}
              onSave={(patch) => onUpdate(sc.id, patch)}
              onDelete={() => onDelete(sc.id)}
              saving={saving}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function ScenarioRow({
  scenario,
  onToggle,
  onSave,
  onDelete,
  saving,
}: {
  scenario: IgreenScenario;
  onToggle: (enabled: boolean) => void;
  onSave: (patch: Partial<IgreenScenario>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(scenario.name);
  const [triggerTag, setTriggerTag] = useState(scenario.trigger_tag ?? "");
  const [tag, setTag] = useState(scenario.final_tag ?? "");
  const [hours, setHours] = useState<number>(scenario.final_tag_delay_hours ?? 24);

  useEffect(() => {
    setName(scenario.name);
    setTriggerTag(scenario.trigger_tag ?? "");
    setTag(scenario.final_tag ?? "");
    setHours(scenario.final_tag_delay_hours ?? 24);
  }, [scenario.name, scenario.trigger_tag, scenario.final_tag, scenario.final_tag_delay_hours]);

  return (
    <AccordionItem value={scenario.id} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 px-4">
        <AccordionTrigger className="flex-1 hover:no-underline">
          <div className="flex items-center gap-3">
            <span className="font-medium">{scenario.name}</span>
            {scenario.trigger_tag ? (
              <Badge variant="outline" className="font-mono text-xs gap-1">
                <Tag className="h-3 w-3" /> {scenario.trigger_tag}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">sem tag de gatilho</Badge>
            )}
            {!scenario.enabled && (
              <Badge variant="secondary" className="text-xs">Desativado</Badge>
            )}
            {scenario.final_tag && (
              <Badge variant="outline" className="text-xs gap-1">
                → {scenario.final_tag} · {scenario.final_tag_delay_hours}h
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Configuração do cenário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tag de gatilho</Label>
                <Input
                  value={triggerTag}
                  onChange={(e) => setTriggerTag(e.target.value)}
                  placeholder="ex: LEAD_FRIO_GREEN"
                />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Excluir cenário
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir cenário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove o cenário "{scenario.name}" e todos os seus dias/mensagens.
                      Inscrições ativas serão interrompidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                className="gap-2"
                disabled={saving}
                onClick={() =>
                  onSave({
                    name: name.trim() || scenario.name,
                    trigger_tag: triggerTag.trim() ? triggerTag.trim() : null,
                  })
                }
              >
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

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
                  onSave({ final_tag: tag.trim() ? tag.trim() : null, final_tag_delay_hours: hours })
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