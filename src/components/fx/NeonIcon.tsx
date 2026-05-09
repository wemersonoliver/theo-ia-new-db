import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NeonIconProps {
  children: ReactNode;
  variant?: "primary" | "cyan" | "purple" | "green";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantMap = {
  primary: "text-primary border-primary/40 shadow-glow-primary bg-primary/5",
  cyan: "text-[hsl(var(--neon-cyan))] border-[hsl(var(--neon-cyan))]/40 shadow-glow-cyan bg-[hsl(var(--neon-cyan))]/5",
  purple: "text-[hsl(var(--neon-purple))] border-[hsl(var(--neon-purple))]/40 shadow-glow-purple bg-[hsl(var(--neon-purple))]/5",
  green: "text-[hsl(var(--neon-green))] border-[hsl(var(--neon-green))]/40 shadow-[0_0_30px_hsl(var(--neon-green)/0.4)] bg-[hsl(var(--neon-green))]/5",
};

const sizeMap = {
  sm: "h-9 w-9 [&>svg]:h-4 [&>svg]:w-4",
  md: "h-12 w-12 [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-16 w-16 [&>svg]:h-7 [&>svg]:w-7",
};

export function NeonIcon({ children, variant = "primary", size = "md", className }: NeonIconProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border backdrop-blur-sm",
        variantMap[variant],
        sizeMap[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
