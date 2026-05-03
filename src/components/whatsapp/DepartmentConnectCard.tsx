import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Smartphone, QrCode, Loader2, RefreshCw, Power, CheckCircle2,
  XCircle, Hash, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WhatsAppInstance } from "@/hooks/useWhatsAppInstances";

interface Props {
  instance: WhatsAppInstance;
  onDisconnect: (id: string) => void;
  onRefresh: (id: string, phoneNumber?: string | null) => void;
  onUpdate: (id: string, patch: Partial<WhatsAppInstance>) => void;
  isBusy?: boolean;
}

export function DepartmentConnectCard({ instance, onDisconnect, onRefresh, onUpdate, isBusy }: Props) {
  const [connectionMode, setConnectionMode] = useState<"qr" | "code">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [codeCopied, setCodeCopied] = useState(false);
  const [name, setName] = useState(instance.display_name || "");
  const [transferMessage, setTransferMessage] = useState(instance.transfer_message || "");

  useEffect(() => { setName(instance.display_name || ""); }, [instance.display_name]);
  useEffect(() => { setTransferMessage(instance.transfer_message || ""); }, [instance.transfer_message]);

  // QR auto-refresh countdown
  useEffect(() => {
    if (instance.status !== "qr_ready" || !instance.qr_code_base64 || connectionMode === "code") {
      setCountdown(30);
      return;
    }
    const t = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) {
          onRefresh(instance.id);
          return 30;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [instance.status, instance.qr_code_base64, connectionMode, instance.id, onRefresh]);

  const qrImageSrc = instance.qr_code_base64
    ? instance.qr_code_base64.startsWith("data:image")
      ? instance.qr_code_base64
      : `data:image/png;base64,${instance.qr_code_base64}`
    : null;

  const formatPairing = (c: string) => {
    const clean = c.replace(/[^A-Za-z0-9]/g, "");
    return clean.length <= 4 ? clean : clean.slice(0, 4) + "-" + clean.slice(4, 8);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText((instance.pairing_code || "").replace(/-/g, ""));
      setCodeCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const statusBadge = () => {
    switch (instance.status) {
      case "connected":
        return <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</Badge>;
      case "qr_ready":
        return <Badge variant="outline" className="text-warning"><QrCode className="mr-1 h-3 w-3" /> Aguardando</Badge>;
      case "disconnected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Desconectado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 truncate">
              <Smartphone className="h-5 w-5 shrink-0" />
              {instance.display_name || "Departamento"}
              {instance.is_primary && <Badge variant="outline" className="ml-1 text-xs">Principal</Badge>}
            </CardTitle>
            <CardDescription className="truncate">
              {instance.phone_number || "Não conectado"} • <code className="text-xs">{instance.instance_name}</code>
            </CardDescription>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {instance.status === "connected" ? (
          <>
            {!instance.is_primary && (
              <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome do departamento</Label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Button size="sm" variant="outline"
                    onClick={() => onUpdate(instance.id, { display_name: name })}
                    disabled={name === (instance.display_name || "")}
                  >Salvar</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Perfil</Label>
                <Input value={instance.profile_name || ""} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">IA ativa</span>
                <Switch
                  checked={instance.ai_enabled}
                  onCheckedChange={(v) => onUpdate(instance.id, { ai_enabled: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Follow-up ativo</span>
                <Switch
                  checked={instance.followup_enabled}
                  onCheckedChange={(v) => onUpdate(instance.id, { followup_enabled: v })}
                />
              </label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mensagem de transferência</Label>
              <Textarea
                rows={2}
                placeholder="Mensagem enviada quando a IA transfere o atendimento para este departamento."
                value={transferMessage}
                onChange={(e) => setTransferMessage(e.target.value)}
              />
              <Button size="sm" variant="outline"
                onClick={() => onUpdate(instance.id, { transfer_message: transferMessage })}
                disabled={transferMessage === (instance.transfer_message || "")}
              >Salvar mensagem</Button>
            </div>
              </>
            )}

            {instance.is_primary && (
              <p className="text-sm text-muted-foreground">
                Este é o número principal. As configurações de IA, follow-up e mensagens são gerenciadas nos menus padrões da plataforma.
              </p>
            )}

            <Button variant="destructive" className="w-full"
              onClick={() => onDisconnect(instance.id)} disabled={isBusy}
            >
              <Power className="mr-2 h-4 w-4" /> Desconectar
            </Button>
          </>
        ) : (
          <Tabs value={connectionMode} onValueChange={(v) => setConnectionMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qr"><QrCode className="mr-2 h-4 w-4" /> QR Code</TabsTrigger>
              <TabsTrigger value="code"><Hash className="mr-2 h-4 w-4" /> Código</TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="flex flex-col items-center">
              {qrImageSrc ? (
                <div className="space-y-3 text-center">
                  <div className="rounded-lg border bg-white p-4">
                    <img src={qrImageSrc} alt="QR Code" className={cn("h-56 w-56", isBusy && "opacity-50")} />
                  </div>
                  <p className="text-sm text-muted-foreground">QR expira em <span className="font-bold text-primary">{countdown}s</span></p>
                </div>
              ) : (
                <div className="space-y-3 py-6 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}
              <div className="mt-4 flex w-full gap-2">
                <Button variant="outline" size="sm" className="flex-1"
                  onClick={() => onRefresh(instance.id)} disabled={isBusy}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                </Button>
                <Button variant="destructive" size="sm" className="flex-1"
                  onClick={() => onDisconnect(instance.id)} disabled={isBusy}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="code" className="flex flex-col items-center">
              <div className="w-full space-y-3 text-center">
                {!instance.pairing_code ? (
                  <>
                    <p className="text-sm text-muted-foreground">Digite o número com código do país</p>
                    <Input
                      placeholder="5511999999999" value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                      className="text-center"
                    />
                    <Button className="w-full" onClick={() => onRefresh(instance.id, phoneInput)}
                      disabled={!phoneInput || isBusy}>
                      <Hash className="mr-2 h-4 w-4" /> Gerar código
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Digite no WhatsApp:</p>
                    <p className="text-xs text-muted-foreground">Configurações → Aparelhos conectados → Conectar com número</p>
                    <div className="rounded-lg border-2 border-primary/20 bg-muted/50 p-4">
                      <p className="font-mono text-2xl font-bold tracking-[0.2em] text-primary">
                        {formatPairing(instance.pairing_code)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button size="sm" onClick={handleCopyCode} className="flex-1">
                        {codeCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {codeCopied ? "Copiado" : "Copiar"}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1"
                        onClick={() => onRefresh(instance.id, phoneInput)} disabled={isBusy}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Novo código
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1"
                        onClick={() => onDisconnect(instance.id)} disabled={isBusy}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}