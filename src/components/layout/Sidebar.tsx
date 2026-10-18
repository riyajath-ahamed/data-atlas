import { useState } from "react";
import type { ViewId } from "../../data/schemas/types.ts";
import { useExplorationStore } from "../../state/exploration-store.ts";
import { AboutDialog } from "./AboutDialog.tsx";

const NAV: { id: ViewId; label: string; testId: string }[] = [
  { id: "overview", label: "Overview", testId: "nav-overview" },
  { id: "geographic", label: "Geographic", testId: "nav-geographic" },
  { id: "scatter", label: "Multidimensional", testId: "nav-scatter" },
  { id: "timeline", label: "Timeline", testId: "nav-timeline" },
  { id: "correlation", label: "Correlation", testId: "nav-correlation" },
  { id: "relationship", label: "Relationships", testId: "nav-relationship" },
  { id: "hierarchy", label: "Hierarchy", testId: "nav-hierarchy" },
  { id: "table", label: "Data", testId: "nav-table" },
];

export function Sidebar() {
  const active = useExplorationStore((state) => state.activeView);
  const setActiveView = useExplorationStore((state) => state.setActiveView);
  const [aboutOpen, setAboutOpen] = useState(false);
  return (
    <nav
      aria-label="Exploration"
      className="flex gap-1 overflow-x-auto bg-primary px-2 py-2 text-on-primary md:w-56 md:flex-col md:overflow-visible md:px-0 md:pt-6 md:pb-8"
    >
      <div className="hidden px-4 pb-6 md:block">
        <p className="font-display text-[1.6rem] leading-[1.19] font-bold tracking-tight">Data Atlas</p>
        <p className="mt-2 text-[13px] text-on-primary/70">Development indicators</p>
      </div>
      {NAV.map((item, index) => (
        <button
          key={item.id}
          type="button"
          data-testid={item.testId}
          aria-current={active === item.id ? "page" : undefined}
          className={`shrink-0 px-3 py-2 text-left text-[14px] font-medium transition-colors duration-75 ease-out active:translate-y-px md:rounded-none md:py-2 ${
            active === item.id
              ? "bg-[#1c2b42] text-on-primary"
              : "text-on-primary/70 hover:bg-white/10 hover:text-on-primary"
          }`}
          onClick={() => setActiveView(item.id)}
        >
          <span className="mr-2 font-mono text-[11px] text-on-primary/50">{String(index + 1).padStart(2, "0")}</span>
          {item.label}
        </button>
      ))}
      <button
        type="button"
        data-testid="nav-about"
        className="shrink-0 px-3 py-2 text-left text-[14px] font-medium text-on-primary/70 transition-colors duration-75 ease-out hover:bg-white/10 hover:text-on-primary active:translate-y-px md:mt-auto md:py-2"
        onClick={() => setAboutOpen(true)}
      >
        About
      </button>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </nav>
  );
}
