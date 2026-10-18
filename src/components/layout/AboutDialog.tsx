import { useEffect, useRef } from "react";
import { useDataset, useDatasetRefresh } from "../../app/dataset.tsx";
import { METRIC_IDS, METRICS } from "../../data/schemas/types.ts";

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dataset = useDataset();
  const { source } = useDatasetRefresh();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog"
      aria-labelledby="about-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(40rem,calc(100svh-2rem))] overflow-auto px-6 pt-6 pb-5">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Disclaimer</p>
        <h2 id="about-title" className="font-display mt-2 text-[1.75rem] leading-[1.19] font-bold tracking-tight">
          About this dashboard
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Data Atlas is an independent reading of published development indicators. It is not a World Bank product, and nothing
          here is a forecast or a policy recommendation.
        </p>

        <h3 className="font-display mt-6 text-[1.15rem] leading-[1.33] font-bold">Where the data comes from</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-ink">
          <li>
            Indicators come from the{" "}
            <a className="text-accent underline underline-offset-2" href="https://data.worldbank.org/" target="_blank" rel="noreferrer">
              World Bank World Development Indicators
            </a>
            . This session is using the {source === "live" ? "extract fetched just now" : "bundled sample"}, retrieved{" "}
            {dataset.meta.retrieved}. It covers {dataset.meta.yearStart}–{dataset.meta.yearEnd}, {dataset.meta.countryCount}{" "}
            economies, and {dataset.meta.observationCount.toLocaleString()} observations.
          </li>
          <li>
            Fetch latest asks the World Bank API for a newer extract in this browser session only. The saved files in the project
            stay as they were.
          </li>
          <li>
            Country shapes are Natural Earth 1:110m, packaged as <span className="font-mono text-[12px]">world-atlas</span> 2.0.2,
            joined to economies with ISO 3166-1 numeric codes. Some small territories have indicator rows and no polygon.
          </li>
          <li>
            Lines in Relationships are shared borders from that map. They are geographic neighbors, not trade, alliance, or
            migration links.
          </li>
        </ul>

        <h3 className="font-display mt-6 text-[1.15rem] leading-[1.33] font-bold">What the dashboard uses</h3>
        <ul className="mt-2 space-y-3 text-[14px] leading-relaxed">
          {METRIC_IDS.map((id) => {
            const metric = METRICS[id];
            return (
              <li key={id}>
                <span className="font-medium text-ink">{metric.shortName}</span>
                <span className="ml-2 font-mono text-[12px] text-faint">{metric.code}</span>
                <span className="text-muted"> · {metric.unit}</span>
                <p className="text-muted">{metric.description}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          A blank mark means the source did not publish a value. It is not stored or drawn as zero. The scatter fit line and the
          correlation matrix describe association in the selected year. They do not show that one indicator causes another.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-solid" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
