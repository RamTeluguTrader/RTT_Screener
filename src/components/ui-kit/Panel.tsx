import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex flex-col overflow-hidden", className)}>
      {title && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn("flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

export function Delta({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("num text-xs font-semibold", value >= 0 ? "text-bull" : "text-bear", className)}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
