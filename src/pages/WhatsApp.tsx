import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { Smartphone, QrCode, Loader2, RefreshCw, Power, CheckCircle2, XCircle, Hash, Copy, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function WhatsApp() {
  const { instance, isLoading, createInstance, disconnectInstance, refreshQRCode } = useWhatsAppInstance();
  const [countdown, setCountdown] = useState(30);
  const [cachedQRCode, setCachedQRCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const instanceStatusRef = useRef(instance?.status);
  const [connectionMode, setConnectionMode] = useState<"qr" | "code">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [cachedPairingCode, setCachedPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = async () => {
    const code = cachedPairingCode || instance?.pairing_code || "";
    const clean = code.replace(/-/g, "");
    try {
      await navigator.clipboard.writeText(clean);
      setCodeCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  };

  useEffect(() => {
    instanceStatusRef.current = instance?.status;
  }, [instance?.status]);

  useEffect(() => {
    return () => {
      if (instanceStatusRef.current === "qr_ready") {
        disconnectInstance.mutate();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (instance?.qr_code_base64) {
      setCachedQRCode(instance.qr_code_base64);
      setIsRefreshing(false);
    }
  }, [instance?.qr_code_base64]);

  useEffect(() => {
    if (instance?.pairing_code) {
      setCachedPairingCode(instance.pairing_code);
      setIsRefreshing(false);
    }
  }, [instance?.pairing_code]);

  useEffect(() => {
    if (instance?.status === "connected") {
      setCachedQRCode(null);
      setCachedPairingCode(null);
      setIsRefreshing(false);
      setCountdown(30);
      setPhoneInput("");
      return;
    }

    if (instance?.status === "disconnected") {
      setCachedQRCode(null);
      setCachedPairingCode(null);
      setIsRefreshing(false);
      setCountdown(30);
    }
  }, [instance?.status]);

  const handleCancelConnection = () => {
    disconnectInstance.mutate();
    setCachedQRCode(null);
    setCachedPairingCode(null);
  };

  const handleRefreshQR = () => {
    setIsRefreshing(true);
    if (connectionMode === "code" && phoneInput) {
      setCachedPairingCode(null);
      refreshQRCode.mutate(phoneInput);
    } else {
      refreshQRCode.mutate();
      setCountdown(30);
    }
  };

  const handleConnectWithCode = () => {
    if (!phoneInput) return;
    setIsRefreshing(true);
    setCachedPairingCode(null);

    if (!instance || instance.status === "disconnected") {
      createInstance.mutate(phoneInput);
    } else {
      refreshQRCode.mutate(phoneInput);
    }
  };

  // Auto-refresh countdown
  useEffect(() => {
    const hasQRCode = Boolean(cachedQRCode || instance?.qr_code_base64);

    if (connectionMode === "code") {
      setIsRefreshing(false);
      return;
    }

    if (instance?.status !== "qr_ready" || !hasQRCode) {
      setCountdown(30);
      setIsRefreshing(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          refreshQRCode.mutate();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [instance?.status, instance?.qr_code_base64, cachedQRCode, refreshQRCode, connectionMode]);

  const qrCodeValue = cachedQRCode || instance?.qr_code_base64 || null;
  const qrImageSrc = qrCodeValue
    ? qrCodeValue.startsWith("data:image")
      ? qrCodeValue
      : `data:image/png;base64,${qrCodeValue}`
    : null;

  const getStatusBadge = () => {
    switch (instance?.status) {
      case "connected":
        return <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</Badge>;
      case "qr_ready":
        return <Badge variant="outline" className="text-warning"><QrCode className="mr-1 h-3 w-3" /> Aguardando Conexão</Badge>;
      case "disconnected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Desconectado</Badge>;
      default:
        return <Badge variant="secondary">Não Configurado</Badge>;
    }
  };

  const formatPairingCode = (code: string) => {
    // Format as XXXX-XXXX
    const clean = code.replace(/[^A-Za-z0-9]/g, "");
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + "-" + clean.slice(4, 8);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="WhatsApp" description="Conecte seu WhatsApp">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="WhatsApp" 
      description="Conecte e gerencie sua instância WhatsApp"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Status da Conexão
                </CardTitle>
                <CardDescription>
                  Gerencie sua instância WhatsApp
                </CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {instance?.status === "connected" && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Número:</span>
                  <span className="font-medium">{instance.phone_number || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Nome do Perfil:</span>
                  <span className="font-medium">{instance.profile_name || "N/A"}</span>
                </div>
                <Button 
                  variant="destructive" 
                  className="mt-4 w-full"
                  onClick={() => disconnectInstance.mutate()}
                  disabled={disconnectInstance.isPending}
                >
                  {disconnectInstance.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="mr-2 h-4 w-4" />
                  )}
                  Desconectar
                </Button>
              </div>
            )}

            {instance?.status !== "connected" && (
              <p className="text-sm text-muted-foreground">
                Use o painel ao lado para conectar via QR Code ou Código de pareamento.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Connection Card with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Conectar WhatsApp
            </CardTitle>
            <CardDescription>
              Escolha como deseja conectar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {instance?.status === "connected" ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
                <p className="mt-4 text-lg font-medium">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground">
                  Seu WhatsApp está pronto para receber mensagens
                </p>
              </div>
            ) : (
              <Tabs value={connectionMode} onValueChange={(v) => setConnectionMode(v as "qr" | "code")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr">
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Code
                  </TabsTrigger>
                  <TabsTrigger value="code">
                    <Hash className="mr-2 h-4 w-4" />
                    Código
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="flex flex-col items-center">
                  <div className="space-y-4 text-center">
                    {qrImageSrc ? (
                      <>
                        <div className="relative rounded-lg border bg-white p-4">
                          <img 
                            src={qrImageSrc}
                            alt="QR Code"
                            className={cn("h-64 w-64 transition-opacity duration-300", isRefreshing && "opacity-50")}
                          />
                          {isRefreshing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          QR Code expira em <span className="font-bold text-primary">{countdown}s</span>
                        </p>
                      </>
                    ) : (instance?.status === "qr_ready" || instance?.status === "pending" || createInstance.isPending || refreshQRCode.isPending) ? (
                      <div className="space-y-3 py-6">
                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                      </div>
                    ) : (
                      <div className="space-y-4 py-6">
                        <QrCode className="mx-auto h-16 w-16 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Clique em "Gerar QR Code" para iniciar a conexão
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => {
                            setIsRefreshing(true);
                            createInstance.mutate();
                          }}
                          disabled={createInstance.isPending}
                        >
                          {createInstance.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="mr-2 h-4 w-4" />
                          )}
                          Gerar QR Code
                        </Button>
                      </div>
                    )}

                    {(qrImageSrc || instance?.status === "qr_ready" || instance?.status === "pending") && (
                    <div className="flex flex-col sm:flex-row gap-2 justify-center pb-20 sm:pb-0 w-full">
                      <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={isRefreshing} className="w-full sm:w-auto">
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Atualizar QR
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleCancelConnection} disabled={disconnectInstance.isPending} className="w-full sm:w-auto">
                        {disconnectInstance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        Cancelar
                      </Button>
                    </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="code" className="flex flex-col items-center">
                  <div className="w-full max-w-sm space-y-4 text-center">
                    {!cachedPairingCode && !instance?.pairing_code ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Digite seu número de telefone com código do país (ex: 5511999999999)
                        </p>
                        <Input
                          placeholder="5511999999999"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                          className="text-center text-lg tracking-wider"
                        />
                        <Button
                          className="w-full"
                          onClick={handleConnectWithCode}
                          disabled={!phoneInput || createInstance.isPending || refreshQRCode.isPending}
                        >
                          {(createInstance.isPending || refreshQRCode.isPending) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Hash className="mr-2 h-4 w-4" />
                          )}
                          Gerar Código
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Digite este código no seu WhatsApp:
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Configurações → Aparelhos conectados → Conectar com número de telefone
                        </p>
                        <div className="relative rounded-lg border-2 border-primary/20 bg-muted/50 p-6">
                          <p className={cn(
                            "text-2xl sm:text-4xl font-mono font-bold tracking-[0.2em] sm:tracking-[0.3em] text-primary transition-opacity duration-300 break-all",
                            isRefreshing && "opacity-50"
                          )}>
                            {formatPairingCode(cachedPairingCode || instance?.pairing_code || "")}
                          </p>
                          {isRefreshing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          O código não é atualizado automaticamente. Se falhar, clique em <span className="font-medium text-foreground">Novo Código</span>.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 justify-center pb-20 sm:pb-0">
                          <Button variant="default" size="sm" onClick={handleCopyCode} className="w-full sm:w-auto">
                            {codeCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {codeCopied ? "Copiado" : "Copiar Código"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={isRefreshing} className="w-full sm:w-auto">
                            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Novo Código
                          </Button>
                          <Button variant="destructive" size="sm" onClick={handleCancelConnection} disabled={disconnectInstance.isPending} className="w-full sm:w-auto">
                            {disconnectInstance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            Cancelar
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
      </div>
    </DashboardLayout>
  );
}
