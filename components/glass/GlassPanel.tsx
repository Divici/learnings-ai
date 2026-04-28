import { forwardRef, type ComponentPropsWithoutRef } from "react";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type GlassPanelProps = ComponentPropsWithoutRef<"div">;

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-panel", className)} {...rest} />;
  }
);
