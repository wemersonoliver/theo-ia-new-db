import { useTutorialVideos } from "@/hooks/useTutorialVideos";

interface OnboardingVideoProps {
  stepKey: string;
}

export function OnboardingVideo({ stepKey }: OnboardingVideoProps) {
  const { getVideoForStep } = useTutorialVideos();
  const videoUrl = getVideoForStep(stepKey);

  if (!videoUrl) return null;

  const getEmbedUrl = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const embedUrl = getEmbedUrl(videoUrl);
  if (!embedUrl) return null;

  return (
    <div className="mb-6">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border">
        <iframe
          src={embedUrl}
          title={`Tutorial - ${stepKey}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}
