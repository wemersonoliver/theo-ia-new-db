import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TutorialVideo {
  id: string;
  step_key: string;
  video_url: string | null;
  file_path: string | null;
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
    mutationFn: async ({ step_key, video_url, file_path }: { step_key: string; video_url: string | null; file_path?: string | null }) => {
      const payload: any = { step_key, video_url };
      if (file_path !== undefined) payload.file_path = file_path;
      const { error } = await supabase
        .from("onboarding_tutorial_videos" as any)
        .upsert(payload, { onConflict: "step_key" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
      toast.success("Vídeo salvo com sucesso");
    },
    onError: () => toast.error("Erro ao salvar vídeo"),
  });

  const uploadVideo = useMutation({
    mutationFn: async ({ step_key, file }: { step_key: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const filePath = `${step_key}.${ext}`;

      // Remove old file if exists
      await supabase.storage.from("tutorial-videos").remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from("tutorial-videos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tutorial-videos")
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from("onboarding_tutorial_videos" as any)
        .upsert(
          { step_key, video_url: null, file_path: urlData.publicUrl },
          { onConflict: "step_key" } as any
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
      toast.success("Vídeo enviado com sucesso");
    },
    onError: () => toast.error("Erro ao enviar vídeo"),
  });

  const deleteVideo = useMutation({
    mutationFn: async (step_key: string) => {
      const video = videos.find((v) => v.step_key === step_key);
      if (video?.file_path) {
        const path = video.file_path.split("/tutorial-videos/").pop();
        if (path) await supabase.storage.from("tutorial-videos").remove([path]);
      }
      const { error } = await supabase
        .from("onboarding_tutorial_videos" as any)
        .upsert(
          { step_key, video_url: null, file_path: null },
          { onConflict: "step_key" } as any
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
      toast.success("Vídeo removido");
    },
    onError: () => toast.error("Erro ao remover vídeo"),
  });

  const getVideoForStep = (step_key: string): { type: "youtube" | "file"; url: string } | null => {
    const video = videos.find((v) => v.step_key === step_key);
    if (!video) return null;
    if (video.file_path) return { type: "file", url: video.file_path };
    if (video.video_url) return { type: "youtube", url: video.video_url };
    return null;
  };

  return { videos, isLoading, upsertVideo, uploadVideo, deleteVideo, getVideoForStep };
}
