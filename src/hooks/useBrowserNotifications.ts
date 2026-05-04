import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/hooks/useAccount";
import { useAcceptanceEnabled } from "@/hooks/usePendingAssignments";
import { useRouletteConfig } from "@/hooks/useRouletteConfig";
import { toast } from "sonner";

const PERMISSION_KEY = "theoia.notifPermissionAsked";

// Curto "ding" via WebAudio (sem precisar de asset)
function playDing() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.start(now);
    o.stop(now + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    /* noop */
  }
}

export function BrowserNotificationsProvider() {
  const { user } = useAuth();
  const { membership } = useAccount();
  const accountId = membership?.account_id;
  const acceptanceEnabled = useAcceptanceEnabled();
  const { config } = useRouletteConfig();
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Pedir permissão na primeira vez
  useEffect(() => {
    if (!user || !acceptanceEnabled) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERMISSION_KEY) === "1") return;
    localStorage.setItem(PERMISSION_KEY, "1");
    Notification.requestPermission().catch(() => {});
  }, [user, acceptanceEnabled]);

  useEffect(() => {
    if (!user || !accountId || !acceptanceEnabled) return;

    const channel = supabase
      .channel(`notif-assignments-${accountId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "roulette_assignments",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row || row.account_id !== accountId) return;
          if (row.status !== "pending") return;
          if (seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);

          const name = row.contact_name || "Sem nome";
          const minutes = config?.accept_timeout_minutes ?? 5;
          const body = `👤 ${name}\n📱 ${row.phone}\nAceite em até ${minutes} min.`;

          playDing();

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const n = new Notification("Novo atendimento aguardando aceite", {
                body,
                tag: `assign-${row.phone}`,
              });
              n.onclick = () => {
                window.focus();
                window.location.href = `/conversations?phone=${encodeURIComponent(row.phone)}`;
                n.close();
              };
            } catch {
              /* noop */
            }
          } else {
            toast.info("Novo atendimento aguardando aceite", { description: body, duration: 10_000 });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, accountId, acceptanceEnabled, config?.accept_timeout_minutes]);

  return null;
}