# Performance

Measurements below are from this workspace on 12 October 2026. They are timings, not a claim that a frame-rate target was met.

## Bundled explorer

One year of the World Bank sample is about 200 countries. The scatter draws those marks in SVG. `CANVAS_THRESHOLD` in `src/features/scatter-explorer/ScatterPlot.tsx` is 1,500 marks. The canvas branch is there for a larger slice, and the bundled year does not cross it.

Hit testing uses a quadtree, including while the pointer moves across the SVG scatter.

A one-off check in the running page, creating 2,000 circles, took 9.9 ms in SVG and 3.6 ms drawing arcs on a canvas. That is a construction cost for a synthetic mark count, not a measured frame time of the explorer. It is not a reason to move the bundled scatter off SVG.

## Processing

`npm run bench` times a labeled synthetic table that is not shown in the UI (`src/engine/benchmarks/synthetic.ts`). One run:

| Work | Rows | Time |
| --- | --- | --- |
| Filter observations | 8,000 | 1.2 ms |
| Pearson matrix, 6 indicators | 8,000 | 66.4 ms |
| Filter observations | 50,000 | 3.4 ms |
| Project scatter positions | 50,000 | 45.4 ms |
| Pearson matrix, 6 indicators | 50,000 | 276.2 ms |

The interactive correlation matrix uses one year, about 200 rows, not this synthetic table. None of these timings is long enough to move that work onto a worker. No worker was added.

Playback on the timeline uses `requestAnimationFrame` and stops when the view unmounts or the year reaches the end of the range. The adjacency simulation also stops on unmount and pauses while the document is hidden.
