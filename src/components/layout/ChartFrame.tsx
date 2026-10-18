import type { ReactNode } from "react";
import type { FocusId } from "../../data/schemas/types.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";

export function ChartFrame({
  title,
  note,
  testId,
  focus,
  toolbar,
  children,
  footer,
}: {
  title: string;
  note?: string;
  testId: string;
  focus?: FocusId;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const focusedView = useExplorationStore((state) => state.focusedView);
  const setFocusedView = useExplorationStore((state) => state.setFocusedView);
  const expanded = focusedView === focus;
  return (
    <section data-testid={testId} className="panel flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] leading-[1.33] font-bold tracking-tight">{title}</h2>
          {note ? <p className="mt-0.5 max-w-[65ch] text-pretty text-[11px] leading-relaxed text-muted">{note}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {toolbar}
          {focus ? (
            <button
              type="button"
              className="field text-[11px] text-muted"
              onClick={() => setFocusedView(expanded ? null : focus)}
            >
              {expanded ? "Close" : "Expand"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
      {footer ? <footer className="border-t border-line px-3 py-2 text-[11px] text-muted">{footer}</footer> : null}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center px-6 text-center">
      <div>
        <p className="font-display text-lg leading-[1.33] font-bold tracking-tight">{title}</p>
        <p className="mt-1.5 max-w-[36ch] text-pretty text-[13px] leading-relaxed text-muted">{detail}</p>
      </div>
    </div>
  );
}

export function ConfigError({ errors }: { errors: string[] }) {
  return (
    <EmptyState
      title="This view cannot be drawn"
      detail={errors.join(" ")}
    />
  );
}
