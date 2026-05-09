import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
  intensity?: "subtle" | "default" | "vivid";
}

/**
 * Animated aurora gradient mesh — pure CSS, no canvas.
 * Sits behind content (use with relative positioned parent).
 */
export function AuroraBackground({ className, intensity = "default" }: AuroraBackgroundProps) {
  const opacity = intensity === "subtle" ? "opacity-50" : intensity === "vivid" ? "opacity-100" : "opacity-80";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden -z-10 hide-on-mobile-fx",
        opacity,
        className,
      )}
    >
      <div className="absolute -top-1/3 -left-1/4 h-[60vh] w-[60vw] rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/3 -right-1/4 h-[55vh] w-[55vw] rounded-full bg-accent/25 blur-3xl animate-pulse-glow" style={{ animationDelay: "1.2s" }} />
      <div className="absolute -bottom-1/4 left-1/3 h-[50vh] w-[50vw] rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "2.4s", background: "hsl(var(--neon-purple) / 0.22)" }} />
    </div>
  );
}
