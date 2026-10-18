import type { ReactNode } from "react";

export function ChartTooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className="menu pointer-events-none absolute z-20 max-w-[240px] px-2.5 py-1.5 text-[11px] leading-snug"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}
