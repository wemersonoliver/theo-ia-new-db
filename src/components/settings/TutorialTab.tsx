import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle } from "lucide-react";

export function TutorialTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Tutorial
        </CardTitle>
        <CardDescription>
          Assista ao vídeo para aprender a usar o sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full max-w-2xl aspect-video rounded-md overflow-hidden bg-muted">
          <iframe
            src="https://www.youtube.com/embed/-MZHYGb0afQ"
            title="Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}
