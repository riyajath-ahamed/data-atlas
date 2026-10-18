# Architecture

React owns the shell, controls, and shared exploration state. D3 owns the marks inside each chart. React does not reconcile circles, paths, or treemap rectangles.

## State

`src/state/exploration-store.ts` is the Zustand store: dataset year, year range, selected country codes, region filter, search, scatter encodings and scales, map metric, timeline metric, correlation metrics, treemap metric, active view, focused view, and theme. Hover lives in `src/state/hover-store.ts` and is not written to the URL or treated as a selection.

`src/state/url-sync.ts` mirrors that snapshot into the query string. Discrete changes use `pushState`. Year and search use `replaceState`. While a `popstate` update is applied, further writes are ignored so the views cannot loop. A missing `year`, `from`, or `to` parameter is left unset. `Number(null)` is 0, and that value must not become the year.

## Data and math

Parsing, validation, and indexing live in `src/data` and `src/engine`. Observations are indexed by country code and by year. Filters, scale domains, 1.5 IQR outliers, ordinary least squares, Pearson correlation, and the two-sided Student t probability are plain TypeScript. Missing values stay `null`.

Pearson correlation uses pairwise-complete countries. The matrix says the coefficient is association, not causation. The t statistic is shown with its formula and the pair count. Hierarchical sort is average-linkage clustering of correlation profiles.

Regional timeline series are population-weighted means. A country missing the metric or the population is omitted from that mean.

The scatter hit test uses a quadtree (`src/engine/indexing/quadtreeIndex.ts`).

## Charts

Each explorer mounts one SVG, or a canvas when the scatter crosses its threshold, and lets D3 draw inside it. A small registry in `src/engine/visualization-registry/` records the known chart types and rejects unknown fields or illegal scales. It is not a general chart framework. Views are wired explicitly in `src/components/layout/AppShell.tsx`.

Focus mode expands one chart and does not clear the store. Escape clears hover.

## Themes

Color is a set of CSS variables. Dark is the default. Light is `data-theme="light"`. Chart sequential and diverging ramps come from `d3-scale-chromatic`. `prefers-reduced-motion` shortens playback and CSS animation.
