import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";

export interface GreetingAudioSlot {
  account_id: string;
  slot: number;
  storage_path: string | null;
  transcript: string;
  delay_after_ms: number;
  enabled: boolean;
  updated_at?: string;
}

export function useIgreenGreetingAudios() {
  const { membership } = useAccount();
  const accountId = membership?.account_id ?? null;
  const qc = useQueryClient();

  const audiosQuery = useQuery({
    queryKey: ["igreen-greeting-audios", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<GreetingAudioSlot[]> => {
      const { data, error } = await supabase
        .from("igreen_account_greeting_audios")
        .select("*")
        .eq("account_id", accountId!)
        .in("slot", [1, 2])
        .order("slot", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GreetingAudioSlot[];
    },
  });

  const toggleQuery = useQuery({
    queryKey: ["igreen-greeting-audio-toggle", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("igreen_greeting_audio_enabled")
        .eq("id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return !!(data as { igreen_greeting_audio_enabled?: boolean } | null)?.igreen_greeting_audio_enabled;
    },
  });

  const setToggle = useMutation({
    mutationFn: async (value: boolean) => {
      if (!accountId) throw new Error("Conta não carregada");
      const { error } = await supabase
        .from("accounts")
        .update({ igreen_greeting_audio_enabled: value })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-greeting-audio-toggle", accountId] });
    },
  });

  const saveSlot = useMutation({
    mutationFn: async (input: {
      slot: number;
      transcript: string;
      enabled: boolean;
      delay_after_ms: number;
      file?: File | null;
    }) => {
      if (!accountId) throw new Error("Conta não carregada");
      let storage_path: string | undefined = undefined;

      if (input.file) {
        const ext = (input.file.name.split(".").pop() || "mp3").toLowerCase();
        const path = `${accountId}/slot-${input.slot}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("igreen-audios")
          .upload(path, input.file, {
            upsert: true,
            contentType: input.file.type || "audio/mpeg",
          });
        if (upErr) throw upErr;
        storage_path = path;
      }

      const row: Record<string, unknown> = {
        account_id: accountId,
        slot: input.slot,
        transcript: input.transcript,
        enabled: input.enabled,
        delay_after_ms: input.delay_after_ms,
      };
      if (storage_path) row.storage_path = storage_path;

      const { error } = await supabase
        .from("igreen_account_greeting_audios")
        .upsert(row, { onConflict: "account_id,slot" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-greeting-audios", accountId] });
    },
  });

  async function getSignedUrl(storage_path: string | null): Promise<string | null> {
    if (!storage_path) return null;
    const { data, error } = await supabase.storage
      .from("igreen-audios")
      .createSignedUrl(storage_path, 60 * 10);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  return {
    accountId,
    audios: audiosQuery.data ?? [],
    loading: audiosQuery.isLoading || toggleQuery.isLoading,
    enabled: !!toggleQuery.data,
    setToggle,
    saveSlot,
    getSignedUrl,
    refetch: () => {
      audiosQuery.refetch();
      toggleQuery.refetch();
    },
  };
}