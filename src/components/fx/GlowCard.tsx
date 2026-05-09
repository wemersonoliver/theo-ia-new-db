import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: "primary" | "cyan" | "purple" | "none";
  interactive?: boolean;
}

export const GlowCard = forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, glow = "primary", interactive = false, ...props }, ref) => {
    const glowMap = {
      primary: "hover:shadow-glow-primary",
      cyan: "hover:shadow-glow-cyan",
      purple: "hover:shadow-glow-purple",
      none: "",
    };
    return (
      <div
        ref={ref}
        className={cn(
          "relative glass rounded-2xl p-6 transition-all duration-300",
          interactive && "cursor-pointer hover:-translate-y-1",
          interactive && glowMap[glow],
          className,
        )}
        {...props}
      />
    );
  },
);
GlowCard.displayName = "GlowCard";
