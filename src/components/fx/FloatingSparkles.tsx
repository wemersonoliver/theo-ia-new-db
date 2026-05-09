import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface FloatingSparklesProps {
  count?: number;
  className?: string;
  color?: "primary" | "cyan" | "purple" | "mixed";
}

const COLORS = {
  primary: "hsl(var(--primary))",
  cyan: "hsl(var(--neon-cyan))",
  purple: "hsl(var(--neon-purple))",
};

/**
 * Floating 4-point AI sparkles. SVG-only, framer-free, GPU-friendly.
 * Respects prefers-reduced-motion.
 */
export function FloatingSparkles({ count = 14, className, color = "mixed" }: FloatingSparklesProps) {
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const palette = color === "mixed"
        ? [COLORS.primary, COLORS.cyan, COLORS.purple]
        : [COLORS[color]];
      return {
        id: i,
        top: `${Math.random() * 95}%`,
        left: `${Math.random() * 95}%`,
        size: 8 + Math.random() * 18,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 5,
        color: palette[i % palette.length],
        opacity: 0.4 + Math.random() * 0.5,
      };
    });
  }, [count, color]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden -z-10", className)}>
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute animate-float"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            filter: `drop-shadow(0 0 8px ${s.color})`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-full w-full animate-sparkle" style={{ animationDelay: `${s.delay}s` }}>
            <path
              d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
              fill={s.color}
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
