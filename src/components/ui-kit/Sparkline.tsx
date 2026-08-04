import { cn } from "@/lib/utils";

export function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 24 - 2}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-20">
      <polyline
        points={pts}
        fill="none"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        className={cn(positive ? "stroke-bull" : "stroke-bear")}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
