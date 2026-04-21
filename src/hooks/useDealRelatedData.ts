import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let p = raw.replace(/\D/g, "");
  if (p.length === 10 || p.length === 11) p = "55" + p;
  if (p.length < 10) return null;
  return p;
}

export interface DealRelatedData {
  lastMessage: { content: string; from_me: boolean; timestamp: string | null } | null;
  nextAppointment: {
    id: string;
    title: string;
    appointment_date: string;
    appointment_time: string;
    assigned_to: string | null;
  } | null;
  hasConversation: boolean;
}

export function useDealRelatedData(phoneRaw: string | null | undefined, enabled: boolean) {
  const phone = normalizePhone(phoneRaw);

  return useQuery({
    queryKey: ["deal-related", phone],
    enabled: enabled && !!phone,
    staleTime: 30_000,
    queryFn: async (): Promise<DealRelatedData> => {
      const today = new Date().toISOString().split("T")[0];

      const [convRes, apptRes] = await Promise.all([
        supabase
          .from("whatsapp_conversations")
          .select("messages, last_message_at")
          .eq("phone", phone!)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, title, appointment_date, appointment_time, assigned_to")
          .eq("phone", phone!)
          .gte("appointment_date", today)
          .neq("status", "cancelled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      let lastMessage: DealRelatedData["lastMessage"] = null;
      const msgs = (convRes.data as any)?.messages;
      if (Array.isArray(msgs) && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        lastMessage = {
          content:
            typeof last?.content === "string"
              ? last.content
              : last?.type
                ? `[${last.type}]`
                : "",
          from_me: !!last?.from_me,
          timestamp: last?.timestamp ?? (convRes.data as any)?.last_message_at ?? null,
        };
      }

      return {
        lastMessage,
        nextAppointment: (apptRes.data as any) || null,
        hasConversation: !!convRes.data,
      };
    },
  });
}

export { normalizePhone };