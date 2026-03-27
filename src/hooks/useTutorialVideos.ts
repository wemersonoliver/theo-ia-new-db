import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TutorialVideo {
  id: string;
  step_key: string;
  video_url: string | null;
}

export function useTutorialVideos() {
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["tutorial-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_tutorial_videos" as any)
        .select("*")
        .order("step_key");
      if (error) throw error;
      return (data || []) as unknown as TutorialVideo[];
    },
  });

  const upsertVideo = useMutation({
    mutationFn: async ({ step_key, video_url }: { step_key: string; video_url: string | null }) => {
      const { error } = await supabase
        .from("onboarding_tutorial_videos" as any)
        .upsert({ step_key, video_url }, { onConflict: "step_key" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
      toast.success("Vídeo salvo com sucesso");
    },
    onError: () => toast.error("Erro ao salvar vídeo"),
  });

  const getVideoForStep = (step_key: string): string | null => {
    const video = videos.find((v) => v.step_key === step_key);
    return video?.video_url || null;
  };

  return { videos, isLoading, upsertVideo, getVideoForStep };
}
