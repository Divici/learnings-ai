import { forwardRef, type ComponentPropsWithoutRef } from "react";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type GlassCardProps = ComponentPropsWithoutRef<"div">;

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-card", className)} {...rest} />;
  }
);
