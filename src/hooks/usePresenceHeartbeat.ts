import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Atualiza account_members.last_seen_at periodicamente para indicar presença online.
 * - Heartbeat a cada 60s enquanto a aba está visível.
 * - Atualização imediata ao montar e ao voltar a ficar visível.
 */
export function usePresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let stopped = false;

    const ping = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        await supabase
          .from("account_members")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("status", "active");
      } catch (e) {
        // silencioso
      }
    };

    ping();
    const interval = window.setInterval(ping, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id]);
}

/** Componente vazio para montar o hook em qualquer árvore. */
export function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}