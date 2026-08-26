import Link from "next/link";
import { cn } from "@/utils/cn";

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className,
      )}
    >
      <span className="neon-glow grid size-8 place-items-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
        S
      </span>
      <span className="neon-text font-[family-name:var(--font-display)] text-[17px] font-bold uppercase tracking-tight text-primary">
        STORYUP
      </span>
    </Link>
  );
}
