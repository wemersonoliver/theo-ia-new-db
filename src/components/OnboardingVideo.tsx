import { useTutorialVideos } from "@/hooks/useTutorialVideos";

interface OnboardingVideoProps {
  stepKey: string;
}

export function OnboardingVideo({ stepKey }: OnboardingVideoProps) {
  const { getVideoForStep } = useTutorialVideos();
  const video = getVideoForStep(stepKey);

  if (!video) return null;

  if (video.type === "file") {
    return (
      <div className="mb-6 w-full">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border">
          <video
            src={video.url}
            controls
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      </div>
    );
  }

  const getEmbedUrl = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const embedUrl = getEmbedUrl(video.url);
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
