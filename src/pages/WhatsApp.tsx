import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { Smartphone, QrCode, Loader2, RefreshCw, Power, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function WhatsApp() {
  const { instance, isLoading, createInstance, disconnectInstance, refreshQRCode } = useWhatsAppInstance();
  const [countdown, setCountdown] = useState(30);
  const [cachedQRCode, setCachedQRCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cache QR code when new one arrives
  useEffect(() => {
    if (instance?.qr_code_base64) {
      setCachedQRCode(instance.qr_code_base64);
      setIsRefreshing(false);
    }
  }, [instance?.qr_code_base64]);

  const handleRefreshQR = () => {
    setIsRefreshing(true);
    refreshQRCode.mutate();
    setCountdown(30);
  };

  // Auto-refresh QR code countdown
  useEffect(() => {
    if (instance?.status !== "qr_ready") {
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
  }, [instance?.status, refreshQRCode]);

  const getStatusBadge = () => {
    switch (instance?.status) {
      case "connected":
        return <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</Badge>;
      case "qr_ready":
        return <Badge variant="outline" className="text-warning"><QrCode className="mr-1 h-3 w-3" /> Aguardando QR</Badge>;
      case "disconnected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Desconectado</Badge>;
      default:
        return <Badge variant="secondary">Não Configurado</Badge>;
    }
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

            {instance?.status === "disconnected" && (
              <Button 
                className="w-full"
                onClick={() => createInstance.mutate()}
                disabled={createInstance.isPending}
              >
                {createInstance.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Reconectar
              </Button>
            )}

            {!instance && (
              <Button 
                className="w-full"
                onClick={() => createInstance.mutate()}
                disabled={createInstance.isPending}
              >
                {createInstance.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="mr-2 h-4 w-4" />
                )}
                Conectar WhatsApp
              </Button>
            )}
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>
              Escaneie com seu WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {instance?.status === "qr_ready" && (cachedQRCode || instance.qr_code_base64) ? (
              <div className="space-y-4 text-center">
                <div className="relative rounded-lg border bg-white p-4">
                  <img 
                    src={`data:image/png;base64,${cachedQRCode || instance.qr_code_base64}`}
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshQR}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Atualizar QR
                </Button>
              </div>
            ) : instance?.status === "connected" ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
                <p className="mt-4 text-lg font-medium">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground">
                  Seu WhatsApp está pronto para receber mensagens
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <QrCode className="mx-auto h-16 w-16 opacity-30" />
                <p className="mt-4">
                  Clique em "Conectar WhatsApp" para gerar o QR Code
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
