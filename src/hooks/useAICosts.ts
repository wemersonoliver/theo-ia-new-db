import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIPricing {
  id: string;
  gemini_text_input_per_1k_cents: number;
  gemini_text_output_per_1k_cents: number;
  gemini_vision_per_image_cents: number;
  groq_audio_per_minute_cents: number;
  suggested_margin_percent: number;
  updated_at: string;
}

export interface AIUsageRow {
  id: string;
  user_id: string;
  kind: "text" | "audio" | "image";
  source: string | null;
  tokens_input: number;
  tokens_output: number;
  audio_seconds: number;
  image_count: number;
  cost_cents: number;
  reference_id: string | null;
  created_at: string;
}

export interface UserCostSummary {
  user_id: string;
  full_name: string | null;
  email: string | null;
  text_calls: number;
  text_tokens_in: number;
  text_tokens_out: number;
  text_cost_cents: number;
  audio_calls: number;
  audio_seconds: number;
  audio_cost_cents: number;
  image_calls: number;
  image_count: number;
  image_cost_cents: number;
  voice_chars: number;
  voice_cost_cents: number;
  total_cost_cents: number;
}

export function useAIPricing() {
  return useQuery({
    queryKey: ["ai-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_pricing_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AIPricing;
    },
  });
}

export function useUpdateAIPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<AIPricing> & { id: string }) => {
      const { error } = await supabase
        .from("ai_pricing_config")
        .update({
          gemini_text_input_per_1k_cents: p.gemini_text_input_per_1k_cents,
          gemini_text_output_per_1k_cents: p.gemini_text_output_per_1k_cents,
          gemini_vision_per_image_cents: p.gemini_vision_per_image_cents,
          groq_audio_per_minute_cents: p.groq_audio_per_minute_cents,
          suggested_margin_percent: p.suggested_margin_percent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-pricing"] });
      toast.success("Preços atualizados");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

/** Carrega TODO o uso (paginando) entre datas e agrega por usuário. */
export function useAICostsSummary(from: Date, to: Date) {
  return useQuery({
    queryKey: ["ai-costs-summary", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      // Paginação para superar o limite de 1000
      const fetchAll = async (table: "ai_usage_log" | "ai_voice_usage") => {
        const all: any[] = [];
        let page = 0;
        const size = 1000;
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: false })
            .range(page * size, page * size + size - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < size) break;
          page++;
        }
        return all;
      };

      const [usage, voice] = await Promise.all([
        fetchAll("ai_usage_log"),
        fetchAll("ai_voice_usage"),
      ]);

      // Reúne ids únicos
      const userIds = Array.from(
        new Set([
          ...usage.map((u: any) => u.user_id).filter(Boolean),
          ...voice.map((u: any) => u.user_id).filter(Boolean),
        ])
      );

      let profilesById: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        for (const p of profiles || []) {
          profilesById[p.user_id] = { full_name: p.full_name, email: p.email };
        }
      }

      const map = new Map<string, UserCostSummary>();
      const ensure = (uid: string): UserCostSummary => {
        if (!map.has(uid)) {
          map.set(uid, {
            user_id: uid,
            full_name: profilesById[uid]?.full_name || null,
            email: profilesById[uid]?.email || null,
            text_calls: 0, text_tokens_in: 0, text_tokens_out: 0, text_cost_cents: 0,
            audio_calls: 0, audio_seconds: 0, audio_cost_cents: 0,
            image_calls: 0, image_count: 0, image_cost_cents: 0,
            voice_chars: 0, voice_cost_cents: 0,
            total_cost_cents: 0,
          });
        }
        return map.get(uid)!;
      };

      for (const u of usage) {
        if (!u.user_id) continue;
        const s = ensure(u.user_id);
        const cost = Number(u.cost_cents) || 0;
        if (u.kind === "text") {
          s.text_calls++;
          s.text_tokens_in += u.tokens_input || 0;
          s.text_tokens_out += u.tokens_output || 0;
          s.text_cost_cents += cost;
        } else if (u.kind === "audio") {
          s.audio_calls++;
          s.audio_seconds += u.audio_seconds || 0;
          s.audio_cost_cents += cost;
        } else if (u.kind === "image") {
          s.image_calls++;
          s.image_count += u.image_count || 0;
          s.image_cost_cents += cost;
        }
        s.total_cost_cents += cost;
      }

      for (const v of voice) {
        if (!v.user_id) continue;
        const s = ensure(v.user_id);
        const cost = Number(v.cost_cents) || 0;
        s.voice_chars += v.characters_count || 0;
        s.voice_cost_cents += cost;
        s.total_cost_cents += cost;
      }

      const summaries = Array.from(map.values()).sort(
        (a, b) => b.total_cost_cents - a.total_cost_cents
      );

      // Série diária
      const dayMap = new Map<string, { date: string; text: number; audio: number; image: number; voice: number; total: number }>();
      const bump = (d: string, key: "text" | "audio" | "image" | "voice", c: number) => {
        if (!dayMap.has(d)) dayMap.set(d, { date: d, text: 0, audio: 0, image: 0, voice: 0, total: 0 });
        const r = dayMap.get(d)!;
        r[key] += c;
        r.total += c;
      };
      for (const u of usage) {
        const d = (u.created_at as string).slice(0, 10);
        bump(d, u.kind as any, Number(u.cost_cents) || 0);
      }
      for (const v of voice) {
        const d = (v.created_at as string).slice(0, 10);
        bump(d, "voice", Number(v.cost_cents) || 0);
      }
      const daily = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      const totals = summaries.reduce(
        (acc, s) => {
          acc.total += s.total_cost_cents;
          acc.text += s.text_cost_cents;
          acc.audio += s.audio_cost_cents;
          acc.image += s.image_cost_cents;
          acc.voice += s.voice_cost_cents;
          return acc;
        },
        { total: 0, text: 0, audio: 0, image: 0, voice: 0 }
      );

      return { summaries, daily, totals, userCount: summaries.length };
    },
  });
}

/** Drill-down: uso detalhado de UM usuário no período. */
export function useUserAIUsage(userId: string | null, from: Date, to: Date) {
  return useQuery({
    queryKey: ["ai-costs-user", userId, from.toISOString(), to.toISOString()],
    enabled: !!userId,
    queryFn: async () => {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const [usageRes, voiceRes] = await Promise.all([
        supabase.from("ai_usage_log").select("*")
          .eq("user_id", userId!)
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("ai_voice_usage").select("*")
          .eq("user_id", userId!)
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(500),
      ]);
      if (usageRes.error) throw usageRes.error;
      if (voiceRes.error) throw voiceRes.error;
      return { usage: (usageRes.data || []) as AIUsageRow[], voice: voiceRes.data || [] };
    },
  });
}