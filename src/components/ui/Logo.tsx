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
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground shadow-xs">
        S
      </span>
      <span className="text-[17px]">STORYUP</span>
    </Link>
  );
}
