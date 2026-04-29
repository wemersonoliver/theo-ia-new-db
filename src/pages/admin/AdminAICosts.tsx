import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAICostsSummary, useAIPricing, useUpdateAIPricing, useUserAIUsage,
  type UserCostSummary,
} from "@/hooks/useAICosts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { DollarSign, Settings2, BarChart3, Search, Users } from "lucide-react";

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format((Number(cents) || 0) / 100);

type Range = "today" | "7d" | "30d" | "90d" | "custom";

function rangeToDates(r: Range, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (r === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (r === "7d") {
    from.setDate(from.getDate() - 7);
  } else if (r === "30d") {
    from.setDate(from.getDate() - 30);
  } else if (r === "90d") {
    from.setDate(from.getDate() - 90);
  } else if (r === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") };
  }
  return { from, to };
}

export default function AdminAICosts() {
  const [range, setRange] = useState<Range>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [drillUser, setDrillUser] = useState<UserCostSummary | null>(null);

  const { from, to } = useMemo(
    () => rangeToDates(range, customFrom, customTo),
    [range, customFrom, customTo]
  );

  const { data, isLoading } = useAICostsSummary(from, to);
  const { data: pricing } = useAIPricing();
  const updatePricing = useUpdateAIPricing();

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    if (!s) return data.summaries;
    return data.summaries.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  return (
    <AdminLayout title="Custos de IA" description="Quanto cada usuário gastou em IA">
      <div className="p-6 space-y-6">
        {/* Header + filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Custos de IA por Usuário</h1>
            <p className="text-slate-400 text-sm">
              Texto (Gemini) + Áudio (Groq) + Imagem (Gemini Vision) + Voz (ElevenLabs)
            </p>
          </div>
          <Button
            onClick={() => setPricingOpen(true)}
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            <Settings2 className="h-4 w-4 mr-2" /> Configurar preços
          </Button>
        </div>

        {/* Range selector */}
        <div className="flex flex-wrap items-end gap-2">
          {(["today", "7d", "30d", "90d", "custom"] as Range[]).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
              className={
                range === r
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }
            >
              {r === "today" ? "Hoje" : r === "custom" ? "Personalizado" : r.toUpperCase()}
            </Button>
          ))}
          {range === "custom" && (
            <>
              <div>
                <Label className="text-xs text-slate-400">De</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Até</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-200"
                />
              </div>
            </>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI title="Custo total" value={fmtBRL(data?.totals.total || 0)} icon={DollarSign} accent="amber" />
          <KPI title="Usuários ativos" value={(data?.userCount || 0).toString()} icon={Users} accent="slate" />
          <KPI title="Texto" value={fmtBRL(data?.totals.text || 0)} icon={BarChart3} accent="slate" />
          <KPI title="Áudio + Imagem" value={fmtBRL((data?.totals.audio || 0) + (data?.totals.image || 0))} icon={BarChart3} accent="slate" />
          <KPI title="Voz (ElevenLabs)" value={fmtBRL(data?.totals.voice || 0)} icon={BarChart3} accent="slate" />
        </div>

        {/* Gráfico */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200 text-base">Evolução diária (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data && data.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily.map(d => ({
                  ...d,
                  text: d.text / 100, audio: d.audio / 100, image: d.image / 100, voice: d.voice / 100, total: d.total / 100,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${v.toFixed(2)}`} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                    formatter={(v: number) => `R$ ${v.toFixed(4)}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} name="Total" />
                  <Line type="monotone" dataKey="text" stroke="#3b82f6" name="Texto" />
                  <Line type="monotone" dataKey="audio" stroke="#10b981" name="Áudio" />
                  <Line type="monotone" dataKey="image" stroke="#a855f7" name="Imagem" />
                  <Line type="monotone" dataKey="voice" stroke="#ec4899" name="Voz" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Sem dados no período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Busca + tabela */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-slate-200"
            />
          </div>
          <Badge variant="secondary" className="bg-slate-800 text-slate-300">
            {filtered.length} usuários
          </Badge>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Usuário</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Texto</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Áudio</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Imagem</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Voz</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Total</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Sugestão*</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">Nenhum uso registrado</TableCell></TableRow>
              ) : filtered.map((u) => {
                const margin = pricing?.suggested_margin_percent || 200;
                const suggestion = u.total_cost_cents * (1 + margin / 100);
                return (
                  <TableRow
                    key={u.user_id}
                    className="border-slate-800 cursor-pointer hover:bg-slate-800/40"
                    onClick={() => setDrillUser(u)}
                  >
                    <TableCell className="text-slate-200">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-slate-500">{u.email || u.user_id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {fmtBRL(u.text_cost_cents)}
                      <div className="text-[10px] text-slate-500">{u.text_calls} msgs</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {fmtBRL(u.audio_cost_cents)}
                      <div className="text-[10px] text-slate-500">{Math.round(u.audio_seconds / 60)} min</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {fmtBRL(u.image_cost_cents)}
                      <div className="text-[10px] text-slate-500">{u.image_count} imgs</div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {fmtBRL(u.voice_cost_cents)}
                      <div className="text-[10px] text-slate-500">{u.voice_chars} chars</div>
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-semibold">
                      {fmtBRL(u.total_cost_cents)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400">
                      {fmtBRL(suggestion)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-800">
            * Custo × (1 + margem sugerida {pricing?.suggested_margin_percent || 200}%). Editável em "Configurar preços".
          </div>
        </div>
      </div>

      {/* Drawer de detalhamento */}
      <UserDrillDialog user={drillUser} from={from} to={to} onClose={() => setDrillUser(null)} />

      {/* Dialog de pricing */}
      <PricingDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        pricing={pricing}
        onSave={(p) => updatePricing.mutateAsync(p)}
        saving={updatePricing.isPending}
      />
    </AdminLayout>
  );
}

function KPI({ title, value, icon: Icon, accent }: { title: string; value: string; icon: any; accent: "amber" | "slate" }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">{title}</p>
            <p className={`text-xl font-bold ${accent === "amber" ? "text-amber-400" : "text-slate-100"}`}>{value}</p>
          </div>
          <Icon className={`h-5 w-5 ${accent === "amber" ? "text-amber-400" : "text-slate-500"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function PricingDialog({
  open, onOpenChange, pricing, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pricing: any;
  onSave: (p: any) => Promise<any>;
  saving: boolean;
}) {
  const [form, setForm] = useState<any>(null);
  // sincroniza form quando abrir
  useMemo(() => { if (open && pricing) setForm({ ...pricing }); }, [open, pricing]);
  if (!form) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar preços de IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Gemini Texto — entrada (centavos por 1k tokens)"
            value={form.gemini_text_input_per_1k_cents}
            onChange={(v) => setForm({ ...form, gemini_text_input_per_1k_cents: v })} />
          <Field label="Gemini Texto — saída (centavos por 1k tokens)"
            value={form.gemini_text_output_per_1k_cents}
            onChange={(v) => setForm({ ...form, gemini_text_output_per_1k_cents: v })} />
          <Field label="Gemini Vision (centavos por imagem)"
            value={form.gemini_vision_per_image_cents}
            onChange={(v) => setForm({ ...form, gemini_vision_per_image_cents: v })} />
          <Field label="Groq Whisper (centavos por minuto)"
            value={form.groq_audio_per_minute_cents}
            onChange={(v) => setForm({ ...form, groq_audio_per_minute_cents: v })} />
          <Field label="Margem sugerida (%)"
            value={form.suggested_margin_percent}
            onChange={(v) => setForm({ ...form, suggested_margin_percent: v })} />
          <p className="text-[11px] text-muted-foreground">
            Use centavos de R$. Ex.: 0,075 cent/1k tokens ≈ R$ 0,00075/1k.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => { await onSave(form); onOpenChange(false); }} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="0.0001" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function UserDrillDialog({ user, from, to, onClose }: { user: UserCostSummary | null; from: Date; to: Date; onClose: () => void }) {
  const { data, isLoading } = useUserAIUsage(user?.user_id || null, from, to);
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {user?.full_name || user?.email || "Usuário"} — {fmtBRL(user?.total_cost_cents || 0)}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-center text-slate-400 py-6">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <Stat label="Mensagens texto" value={user?.text_calls.toString() || "0"} />
              <Stat label="Tokens in/out" value={`${user?.text_tokens_in || 0} / ${user?.text_tokens_out || 0}`} />
              <Stat label="Áudio (min)" value={Math.round((user?.audio_seconds || 0) / 60).toString()} />
              <Stat label="Imagens" value={(user?.image_count || 0).toString()} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Últimas 500 chamadas</h4>
              <div className="rounded border border-slate-800 max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-xs text-amber-400/70">Quando</TableHead>
                      <TableHead className="text-xs text-amber-400/70">Tipo</TableHead>
                      <TableHead className="text-xs text-amber-400/70">Origem</TableHead>
                      <TableHead className="text-xs text-amber-400/70 text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.usage || []).slice(0, 200).map((r) => (
                      <TableRow key={r.id} className="border-slate-800">
                        <TableCell className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs"><Badge variant="secondary" className="bg-slate-800 text-slate-300">{r.kind}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-400">{r.source || "—"}</TableCell>
                        <TableCell className="text-xs text-right text-slate-200">{fmtBRL(r.cost_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}