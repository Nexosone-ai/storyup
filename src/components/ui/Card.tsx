import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "muted" | "primary" | "warning";
  className?: string;
}) {
  const tones = {
    default:
      "bg-surface-muted text-foreground ring-1 ring-inset ring-border-strong/50",
    success: "bg-primary-soft text-primary ring-1 ring-inset ring-primary/15",
    muted: "bg-surface-muted text-muted ring-1 ring-inset ring-border-strong/40",
    primary: "bg-primary-soft text-primary ring-1 ring-inset ring-primary/15",
    warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/15",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
