import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useFollowupHolidays } from "@/hooks/useFollowupHolidays";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function HolidaysManager() {
  const { holidaysQuery, createHoliday, deleteHoliday, seedBrazilianHolidays } = useFollowupHolidays();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [recurring, setRecurring] = useState(false);

  const handleAdd = async () => {
    if (!date || !name.trim()) return;
    await createHoliday.mutateAsync({ date, name: name.trim(), recurring });
    setDate(""); setName(""); setRecurring(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendário de feriados
          </CardTitle>
          <CardDescription>
            Os fluxos com a opção <strong>"Pausar em feriados"</strong> ativada não enviam mensagens nessas datas.
            Mensagens agendadas para feriado são reagendadas para o próximo dia útil dentro da janela de envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aniversário da empresa" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={recurring} onCheckedChange={setRecurring} id="rec" />
              <Label htmlFor="rec" className="text-xs">Repete todo ano</Label>
            </div>
            <Button onClick={handleAdd} disabled={createHoliday.isPending || !date || !name.trim()}>
              {createHoliday.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => seedBrazilianHolidays.mutate(new Date().getFullYear())}
            disabled={seedBrazilianHolidays.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Importar feriados nacionais ({new Date().getFullYear()})
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feriados cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {holidaysQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (holidaysQuery.data?.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground p-6 text-sm">Nenhum feriado cadastrado.</p>
          ) : (
            <div className="divide-y">
              {holidaysQuery.data!.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {format(parseISO(h.date), "dd 'de' MMM yyyy", { locale: ptBR })}
                    </Badge>
                    <span className="text-sm font-medium">{h.name}</span>
                    {h.recurring && <Badge variant="secondary" className="text-xs">Anual</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteHoliday.mutate(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}