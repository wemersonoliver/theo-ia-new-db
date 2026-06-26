import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Save, Plus, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Painel admin do TEMPLATE Igreen.
 * Tudo o que é editado aqui é compartilhado por TODAS as contas Igreen.
 * - Prompt (tabela igreen_default_ai_config, singleton)
 * - Produtos globais (tabela igreen_products)
 * - Base de conhecimento global Igreen (knowledge_base_documents.is_igreen_global)
 * - Tabela de regras por distribuidora (igreen_distributor_discounts)
 */
export default function AdminIgreenTemplate() {
  return (
    <AdminLayout title="Template Igreen" description="Conteúdo compartilhado por TODAS as contas do plano Igreen">
      <Tabs defaultValue="prompt" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="prompt">Prompt da IA</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="kb">Base de Conhecimento</TabsTrigger>
          <TabsTrigger value="discounts">Regras por Distribuidora</TabsTrigger>
          <TabsTrigger value="audios">Áudios de Saudação</TabsTrigger>
        </TabsList>
        <TabsContent value="prompt"><PromptTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="kb"><KnowledgeTab /></TabsContent>
        <TabsContent value="discounts"><DiscountsTab /></TabsContent>
        <TabsContent value="audios"><GreetingAudiosTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

/* ============================== ÁUDIOS DE SAUDAÇÃO ============================== */
function GreetingAudiosTab() {
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base text-amber-400">Áudios de Saudação (Green)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 space-y-1">
          <p>Estes 2 áudios substituem o texto de boas-vindas atual do produto <strong>green</strong>. Valem para <strong>todas as contas iGreen</strong>.</p>
          <p>O áudio 1 é enviado assim que o cliente abre a conversa. O áudio 2 é enviado <strong>10 segundos depois</strong>. O WhatsApp do cliente mostra "gravando áudio…" antes de cada um.</p>
          <p className="text-xs text-amber-300/80">A transcrição é o que a IA "lembra" do que falou. Sempre revise a transcrição ao trocar o áudio para o atendimento continuar coerente.</p>
        </CardContent>
      </Card>
      <GreetingAudioSlotCard slot={1} title="Áudio 1 — Apresentação" />
      <GreetingAudioSlotCard slot={2} title="Áudio 2 — Pedir estado" />
    </div>
  );
}

function GreetingAudioSlotCard({ slot, title }: { slot: number; title: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [row, setRow] = useState<any>({ slot, storage_path: null, transcript: "", delay_after_ms: slot === 2 ? 10000 : 0, enabled: true });
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("igreen_default_greeting_audios")
      .select("*").eq("slot", slot).maybeSingle();
    if (data) setRow(data);
    if (data?.storage_path) {
      const { data: sig } = await (supabase as any).storage
        .from("igreen-audios").createSignedUrl(data.storage_path, 60 * 30);
      setSignedUrl(sig?.signedUrl ?? null);
    } else {
      setSignedUrl(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slot]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo acima de 16 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "ogg";
    const path = `slot-${slot}/${Date.now()}.${ext}`;
    const { error: upErr } = await (supabase as any).storage
      .from("igreen-audios").upload(path, file, { upsert: false, contentType: file.type || "audio/ogg" });
    if (upErr) { toast.error("Falha no upload: " + upErr.message); setUploading(false); return; }
    // Apaga arquivo anterior se existir
    if (row.storage_path) {
      await (supabase as any).storage.from("igreen-audios").remove([row.storage_path]);
    }
    const { error: updErr } = await (supabase as any)
      .from("igreen_default_greeting_audios")
      .update({ storage_path: path })
      .eq("slot", slot);
    if (updErr) { toast.error("Erro salvando caminho: " + updErr.message); setUploading(false); return; }
    toast.success("Áudio enviado");
    setUploading(false);
    await load();
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("igreen_default_greeting_audios")
      .update({
        transcript: row.transcript ?? "",
        delay_after_ms: Number(row.delay_after_ms) || 0,
        enabled: !!row.enabled,
      })
      .eq("slot", slot);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Salvo");
  };

  if (loading) return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardContent className="p-6 flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</CardContent>
    </Card>
  );

  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-base text-amber-400 flex items-center justify-between">
          <span>{title}</span>
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <Switch checked={!!row.enabled} onCheckedChange={(v) => setRow({ ...row, enabled: v })} />
            {row.enabled ? "Ativo" : "Inativo"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-slate-400">Arquivo de áudio (mp3, ogg ou m4a — até 16 MB)</Label>
          <div className="flex items-center gap-3 mt-1">
            <Input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/ogg,audio/mp4,audio/m4a,audio/aac,audio/wav,audio/*"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              className="bg-slate-950 border-slate-700"
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
          </div>
          {signedUrl ? (
            <audio controls src={signedUrl} className="mt-3 w-full" />
          ) : (
            <p className="mt-2 text-xs text-amber-300/80">Nenhum áudio enviado ainda — o agente usa o texto antigo até você subir um arquivo.</p>
          )}
        </div>

        <div>
          <Label className="text-xs text-slate-400">Transcrição (a IA usa este texto como contexto da conversa)</Label>
          <Textarea
            value={row.transcript ?? ""}
            onChange={(e) => setRow({ ...row, transcript: e.target.value })}
            rows={5}
            className="bg-slate-950 border-slate-700 mt-1"
            placeholder="Cole aqui exatamente o que está dito no áudio."
          />
        </div>

        {slot === 2 && (
          <div>
            <Label className="text-xs text-slate-400">Intervalo antes deste áudio (ms)</Label>
            <Input
              type="number"
              value={row.delay_after_ms ?? 10000}
              onChange={(e) => setRow({ ...row, delay_after_ms: e.target.value })}
              className="bg-slate-950 border-slate-700 mt-1 w-40"
            />
            <p className="text-xs text-slate-500 mt-1">Padrão: 10000 (10 segundos depois do áudio 1)</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================== PROMPT ============================== */
function PromptTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<any>({ singleton: true, agent_name: "", business_niche: "", business_description: "", custom_prompt: "" });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("igreen_default_ai_config").select("*").eq("singleton", true).maybeSingle();
      if (data) setRow(data);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      singleton: true,
      agent_name: row.agent_name,
      business_niche: row.business_niche,
      business_description: row.business_description,
      custom_prompt: row.custom_prompt,
    };
    const { error } = await (supabase as any).from("igreen_default_ai_config").upsert(payload, { onConflict: "singleton" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Prompt Igreen salvo. Todas as contas Igreen já estão usando.");
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-amber-400" />;

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader><CardTitle className="text-amber-400">Prompt oficial Igreen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Nome do agente</Label>
            <Input value={row.agent_name || ""} onChange={(e) => setRow({ ...row, agent_name: e.target.value })} />
          </div>
          <div>
            <Label>Nicho</Label>
            <Input value={row.business_niche || ""} onChange={(e) => setRow({ ...row, business_niche: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Sobre o negócio</Label>
          <Textarea rows={4} value={row.business_description || ""} onChange={(e) => setRow({ ...row, business_description: e.target.value })} />
        </div>
        <div>
          <Label>Prompt da IA (instruções de atendimento)</Label>
          <Textarea rows={18} value={row.custom_prompt || ""} onChange={(e) => setRow({ ...row, custom_prompt: e.target.value })} className="font-mono text-xs" />
        </div>
        <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar prompt
        </Button>
      </CardContent>
    </Card>
  );
}

/* ============================== PRODUTOS ============================== */
function ProductsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("igreen_products").select("*").order("position", { ascending: true });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (row: any) => {
    const { error } = await (supabase as any).from("igreen_products").upsert({
      key: row.key, name: row.name, description: row.description,
      enabled: row.enabled, position: row.position,
      video_url: row.video_url || null,
      followup_after_video_seconds: row.followup_after_video_seconds || null,
      followup_after_video_message: row.followup_after_video_message || null,
    }, { onConflict: "key" });
    if (error) toast.error(error.message); else { toast.success(`Produto "${row.name}" salvo.`); load(); }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-amber-400" />;

  return (
    <div className="space-y-4">
      {rows.map((r, idx) => (
        <Card key={r.key} className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-amber-400">{r.name} <span className="text-xs text-slate-500 ml-2">({r.key})</span></CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-400">Ativo</Label>
              <Switch checked={!!r.enabled} onCheckedChange={(v) => { const c=[...rows]; c[idx]={...r,enabled:v}; setRows(c); }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={r.name||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,name:e.target.value};setRows(c);}} /></div>
              <div><Label>Posição</Label><Input type="number" value={r.position??0} onChange={(e)=>{const c=[...rows];c[idx]={...r,position:Number(e.target.value)};setRows(c);}} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={2} value={r.description||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,description:e.target.value};setRows(c);}} /></div>
            <div><Label>URL do vídeo de apresentação</Label><Input value={r.video_url||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,video_url:e.target.value};setRows(c);}} placeholder="https://..." /></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Follow-up após vídeo (segundos)</Label><Input type="number" value={r.followup_after_video_seconds||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,followup_after_video_seconds:Number(e.target.value)};setRows(c);}} /></div>
              <div><Label>Mensagem de follow-up</Label><Input value={r.followup_after_video_message||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,followup_after_video_message:e.target.value};setRows(c);}} /></div>
            </div>
            <Button onClick={() => save(r)} className="bg-amber-500 hover:bg-amber-600 text-slate-950"><Save className="h-4 w-4 mr-2" />Salvar</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============================== BASE DE CONHECIMENTO ============================== */
function KnowledgeTab() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      (supabase as any).from("knowledge_base_documents").select("id, file_name, status, igreen_global_product_key, created_at").eq("is_igreen_global", true).order("created_at", { ascending: false }),
      (supabase as any).from("igreen_products").select("key, name").order("position"),
    ]);
    setDocs(d || []);
    setProducts(p || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error("Sem usuário");
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `igreen-global/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("knowledge-base").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: doc, error: insErr } = await (supabase as any).from("knowledge_base_documents").insert({
        user_id: userId, file_name: file.name, file_path: path, file_size: file.size,
        mime_type: file.type, status: "pending", is_igreen_global: true,
      }).select("id").single();
      if (insErr) throw insErr;
      await supabase.functions.invoke("process-knowledge-document", { body: { document_id: doc.id } });
      toast.success("Documento enviado e processando.");
      load();
    } catch (err: any) {
      toast.error(err.message || "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const setProductKey = async (id: string, key: string | null) => {
    const { error } = await (supabase as any).from("knowledge_base_documents").update({ igreen_global_product_key: key }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (d: any) => {
    if (!confirm(`Remover "${d.file_name}"?`)) return;
    await supabase.storage.from("knowledge-base").remove([d.file_path]).catch(() => {});
    const { error } = await (supabase as any).from("knowledge_base_documents").delete().eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-amber-400">Base de Conhecimento Igreen (global)</CardTitle>
        <label>
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt,.md,.docx" />
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-950" disabled={uploading}>
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Enviar documento</span>
          </Button>
        </label>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-400" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-amber-400/70 font-semibold uppercase">Arquivo</TableHead>
              <TableHead className="text-amber-400/70 font-semibold uppercase">Status</TableHead>
              <TableHead className="text-amber-400/70 font-semibold uppercase">Produto</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.file_name}</TableCell>
                  <TableCell><span className="text-xs px-2 py-0.5 rounded bg-slate-800">{d.status}</span></TableCell>
                  <TableCell>
                    <select className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                      value={d.igreen_global_product_key || ""}
                      onChange={(e) => setProductKey(d.id, e.target.value || null)}>
                      <option value="">— Geral —</option>
                      {products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {docs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">Nenhum documento global Igreen ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================== REGRAS POR DISTRIBUIDORA ============================== */
function DiscountsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("igreen_distributor_discounts").select("*").order("state").order("distributor");
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upsert = async (r: any) => {
    const payload: any = {
      state: r.state, state_name: r.state_name, distributor: r.distributor,
      distributor_aliases: typeof r.distributor_aliases === "string"
        ? r.distributor_aliases.split(",").map((s: string) => s.trim()).filter(Boolean)
        : (r.distributor_aliases || []),
      discount_min_percent: r.discount_min_percent ? Number(r.discount_min_percent) : null,
      discount_max_percent: r.discount_max_percent ? Number(r.discount_max_percent) : null,
      min_bill_brl: r.min_bill_brl ? Number(r.min_bill_brl) : null,
      modalidade: r.modalidade, credit_analysis: r.credit_analysis,
      injection_days: r.injection_days, notes: r.notes,
      enabled: r.enabled !== false,
    };
    if (r.id) payload.id = r.id;
    const { error } = await (supabase as any).from("igreen_distributor_discounts").upsert(payload);
    if (error) toast.error(error.message); else { toast.success("Regra salva"); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar esta regra?")) return;
    const { error } = await (supabase as any).from("igreen_distributor_discounts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Apagada"); load(); }
  };

  const addBlank = () => setRows([...rows, { state: "", state_name: "", distributor: "", distributor_aliases: "", enabled: true }]);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-amber-400" />;

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-amber-400">Regras por Distribuidora (Conexão Green)</CardTitle>
        <Button onClick={addBlank} className="bg-amber-500 hover:bg-amber-600 text-slate-950"><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, idx) => (
          <div key={r.id || `new-${idx}`} className="grid md:grid-cols-12 gap-2 items-end p-3 rounded bg-slate-950/40 border border-slate-800">
            <div className="md:col-span-1"><Label className="text-xs">UF</Label><Input value={r.state||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,state:e.target.value.toUpperCase()};setRows(c);}} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Estado</Label><Input value={r.state_name||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,state_name:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Distribuidora</Label><Input value={r.distributor||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,distributor:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Aliases (vírgula)</Label><Input value={Array.isArray(r.distributor_aliases)?r.distributor_aliases.join(", "):(r.distributor_aliases||"")} onChange={(e)=>{const c=[...rows];c[idx]={...r,distributor_aliases:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-1"><Label className="text-xs">Min %</Label><Input type="number" value={r.discount_min_percent??""} onChange={(e)=>{const c=[...rows];c[idx]={...r,discount_min_percent:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-1"><Label className="text-xs">Max %</Label><Input type="number" value={r.discount_max_percent??""} onChange={(e)=>{const c=[...rows];c[idx]={...r,discount_max_percent:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-1"><Label className="text-xs">Conta min R$</Label><Input type="number" value={r.min_bill_brl??""} onChange={(e)=>{const c=[...rows];c[idx]={...r,min_bill_brl:e.target.value};setRows(c);}} /></div>
            <div className="md:col-span-2 flex gap-2">
              <Button size="sm" onClick={() => upsert(r)} className="bg-amber-500 hover:bg-amber-600 text-slate-950"><Save className="h-4 w-4" /></Button>
              {r.id && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>}
            </div>
            <div className="md:col-span-12 grid md:grid-cols-4 gap-2">
              <div><Label className="text-xs">Modalidade</Label><Input value={r.modalidade||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,modalidade:e.target.value};setRows(c);}} /></div>
              <div><Label className="text-xs">Análise crédito</Label><Input value={r.credit_analysis||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,credit_analysis:e.target.value};setRows(c);}} /></div>
              <div><Label className="text-xs">Dias injeção</Label><Input value={r.injection_days||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,injection_days:e.target.value};setRows(c);}} /></div>
              <div><Label className="text-xs">Notas</Label><Input value={r.notes||""} onChange={(e)=>{const c=[...rows];c[idx]={...r,notes:e.target.value};setRows(c);}} /></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}