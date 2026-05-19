import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { n: 1, label: "D-3 — Lembrete amigável" },
  { n: 2, label: "D-2 — Urgência leve" },
  { n: 3, label: "D-1 — Último dia" },
  { n: 4, label: "D+2 — Escuta empática" },
  { n: 5, label: "D+4 — Prova social" },
  { n: 6, label: "D+6 — Personalizada com {business_context}" },
  { n: 7, label: "D+7 — Meta-gancho (insistência)" },
  { n: 8, label: "D+9 — Desconto {desconto}% — cupom {cupom}" },
  { n: 9, label: "D+11 — Fechamento elegante" },
];

type Config = any;
type Tracking = {
  id: string;
  account_id: string;
  owner_user_id: string;
  phone: string;
  trial_ends_at: string;
  current_step: number;
  status: string;
  next_scheduled_at: string | null;
  last_sent_at: string | null;
  business_context: string | null;
  profile?: { full_name?: string; email?: string } | null;
};

export default function AdminTrialFollowup() {
  const [config, setConfig] = useState<Config | null>(null);
  const [tracking, setTracking] = useState<Tracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: cfg } = await supabase
      .from("trial_notification_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    setConfig(cfg);

    const { data: trk } = await supabase
      .from("trial_notification_tracking")
      .select("*")
      .order("trial_ends_at", { ascending: true });

    if (trk && trk.length > 0) {
      const ids = Array.from(new Set(trk.map((t: any) => t.owner_user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      setTracking(trk.map((t: any) => ({ ...t, profile: map.get(t.owner_user_id) })));
    } else {
      setTracking([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("trial_notification_config")
      .update({
        enabled: config.enabled,
        morning_window_start: config.morning_window_start,
        morning_window_end: config.morning_window_end,
        evening_window_start: config.evening_window_start,
        evening_window_end: config.evening_window_end,
        discount_coupon_code: config.discount_coupon_code,
        discount_percent: Number(config.discount_percent) || 20,
        step_1_template: config.step_1_template,
        step_2_template: config.step_2_template,
        step_3_template: config.step_3_template,
        step_4_template: config.step_4_template,
        step_5_template: config.step_5_template,
        step_6_template: config.step_6_template,
        step_7_template: config.step_7_template,
        step_8_template: config.step_8_template,
        step_9_template: config.step_9_template,
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva");
  };

  const cancelFlow = async (accountId: string) => {
    const { error } = await supabase.rpc("cancel_trial_notification", {
      p_account_id: accountId,
      p_reason: "handoff",
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Fluxo cancelado"); load(); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "bg-blue-500/15 text-blue-300",
      paused_engaged: "bg-amber-500/15 text-amber-300",
      converted: "bg-emerald-500/15 text-emerald-300",
      handoff: "bg-violet-500/15 text-violet-300",
      exhausted: "bg-slate-500/15 text-slate-300",
    };
    return <Badge className={map[s] || "bg-slate-500/15 text-slate-300"}>{s}</Badge>;
  };

  return (
    <AdminLayout
      title="Recuperação de Trial"
      description="Sequência automática de WhatsApp para clientes em teste que ainda não assinaram"
    >
      <div className="p-6 space-y-6">
        {loading || !config ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        ) : (
          <>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-amber-400 text-lg">Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!config.enabled}
                    onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  />
                  <Label className="text-slate-200">Fluxo ativo</Label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Manhã início</Label>
                    <Input value={config.morning_window_start} onChange={(e) => setConfig({ ...config, morning_window_start: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Manhã fim</Label>
                    <Input value={config.morning_window_end} onChange={(e) => setConfig({ ...config, morning_window_end: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Tarde início</Label>
                    <Input value={config.evening_window_start} onChange={(e) => setConfig({ ...config, evening_window_start: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Tarde fim</Label>
                    <Input value={config.evening_window_end} onChange={(e) => setConfig({ ...config, evening_window_end: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Cupom</Label>
                    <Input value={config.discount_coupon_code} onChange={(e) => setConfig({ ...config, discount_coupon_code: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Desconto (%)</Label>
                    <Input type="number" value={config.discount_percent} onChange={(e) => setConfig({ ...config, discount_percent: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Placeholders: <code>{"{nome}"}</code>, <code>{"{business_context}"}</code>,{" "}
                    <code>{"{link_checkout}"}</code>, <code>{"{cupom}"}</code>, <code>{"{desconto}"}</code>
                  </p>
                  {STEPS.map((s) => (
                    <div key={s.n}>
                      <Label className="text-sm font-semibold text-amber-400/80 uppercase tracking-wide">
                        Step {s.n} — {s.label}
                      </Label>
                      <Textarea
                        rows={3}
                        value={config[`step_${s.n}_template`] || ""}
                        onChange={(e) => setConfig({ ...config, [`step_${s.n}_template`]: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-slate-100"
                      />
                    </div>
                  ))}
                </div>

                <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar configuração
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-amber-400 text-lg">
                  Clientes em fluxo ({tracking.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Cliente</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Telefone</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Trial fim</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Step</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Próximo envio</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-amber-400/70 uppercase text-xs font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tracking.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-6">Nenhum cliente no fluxo</TableCell></TableRow>
                    ) : tracking.map((t) => (
                      <TableRow key={t.id} className="border-slate-800">
                        <TableCell className="text-slate-200">
                          <div className="font-medium">{t.profile?.full_name || "—"}</div>
                          <div className="text-xs text-slate-500">{t.profile?.email}</div>
                        </TableCell>
                        <TableCell className="text-slate-300 font-mono text-xs">{t.phone}</TableCell>
                        <TableCell className="text-slate-300 text-xs">{new Date(t.trial_ends_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-slate-300">{t.current_step}/9</TableCell>
                        <TableCell className="text-slate-300 text-xs">
                          {t.next_scheduled_at ? new Date(t.next_scheduled_at).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                        <TableCell>
                          {(t.status === "scheduled" || t.status === "paused_engaged") && (
                            <Button size="sm" variant="ghost" onClick={() => cancelFlow(t.account_id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}