import type { Grade } from "@/lib/diagnostics/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Grade, string> = {
  A: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  B: "bg-sky-100 text-sky-900 ring-sky-300",
  C: "bg-amber-100 text-amber-900 ring-amber-300",
  D: "bg-orange-100 text-orange-900 ring-orange-300",
  F: "bg-red-100 text-red-900 ring-red-300",
};

export function GradeBadge({
  grade,
  className,
}: {
  grade: Grade;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-md text-sm font-semibold ring-1 ring-inset",
        STYLES[grade],
        className,
      )}
    >
      {grade}
    </span>
  );
}
