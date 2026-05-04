import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Loader2 } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useEffect, useState } from "react";

const AI_HOURS_DRAFT_KEY = "theo-ai-hours-draft";

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function AIHoursTab() {
  const { config, saveConfig } = useAIConfig();
  const [formData, setFormData] = useState({
    business_hours_start: "00:00",
    business_hours_end: "23:59",
    business_days: [0, 1, 2, 3, 4, 5, 6] as number[],
    out_of_hours_message: "Olá! Estou fora do horário de atendimento. Retornarei em breve!",
  });

  useEffect(() => {
    const draft = sessionStorage.getItem(AI_HOURS_DRAFT_KEY);
    if (draft) {
      setFormData(JSON.parse(draft));
      return;
    }
    if (config) {
      setFormData({
        business_hours_start: config.business_hours_start || "00:00",
        business_hours_end: config.business_hours_end || "23:59",
        business_days: config.business_days || [0, 1, 2, 3, 4, 5, 6],
        out_of_hours_message: config.out_of_hours_message || "",
      });
    }
  }, [config]);

  useEffect(() => {
    sessionStorage.setItem(AI_HOURS_DRAFT_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter((d) => d !== day)
        : [...prev.business_days, day].sort(),
    }));
  };

  const handleSave = () => saveConfig.mutate(formData, {
    onSuccess: () => sessionStorage.removeItem(AI_HOURS_DRAFT_KEY),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horário de Funcionamento
          </CardTitle>
          <CardDescription>Define quando o agente responde automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Atendimento 24 horas</Label>
              <p className="text-xs text-muted-foreground">Agente responde a qualquer hora, todos os dias</p>
            </div>
            <Switch
              checked={
                formData.business_hours_start === "00:00" &&
                formData.business_hours_end === "23:59" &&
                formData.business_days.length === 7
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  setFormData({
                    ...formData,
                    business_hours_start: "00:00",
                    business_hours_end: "23:59",
                    business_days: [0, 1, 2, 3, 4, 5, 6],
                  });
                } else {
                  setFormData({
                    ...formData,
                    business_hours_start: "08:00",
                    business_hours_end: "18:00",
                    business_days: [1, 2, 3, 4, 5],
                  });
                }
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours_start">Início</Label>
              <Input
                id="hours_start"
                type="time"
                value={formData.business_hours_start}
                onChange={(e) => setFormData({ ...formData, business_hours_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours_end">Fim</Label>
              <Input
                id="hours_end"
                type="time"
                value={formData.business_hours_end}
                onChange={(e) => setFormData({ ...formData, business_hours_end: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Dias de Funcionamento</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={formData.business_days.includes(day.value)}
                    onCheckedChange={() => handleDayToggle(day.value)}
                  />
                  <Label htmlFor={`day-${day.value}`} className="text-sm">
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="out_of_hours">Mensagem Fora do Horário</Label>
            <Textarea
              id="out_of_hours"
              value={formData.out_of_hours_message}
              onChange={(e) => setFormData({ ...formData, out_of_hours_message: e.target.value })}
              placeholder="Mensagem enviada fora do horário de atendimento"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveConfig.isPending}>
        {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
}