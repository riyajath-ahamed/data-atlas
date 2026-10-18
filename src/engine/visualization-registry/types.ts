import type { MetricId, ScaleKind } from "../../data/schemas/types.ts";

export interface ScatterConfiguration {
  type: "scatter";
  x: MetricId;
  y: MetricId;
  size?: MetricId;
  color?: "region";
  scale?: {
    x?: ScaleKind;
    y?: ScaleKind;
  };
  interaction?: {
    brush?: boolean;
    zoom?: boolean;
    selection?: boolean;
  };
  opacity?: number;
  regression?: boolean;
}

export interface ChoroplethConfiguration {
  type: "choropleth";
  metric: MetricId;
  scheme?: "sequential" | "diverging";
}

export interface TimelineConfiguration {
  type: "timeline";
  metric: MetricId;
  representation?: "line" | "area";
}

export type VisualizationConfig = ScatterConfiguration | ChoroplethConfiguration | TimelineConfiguration | CorrelationConfiguration | NetworkConfiguration | TreemapConfiguration;

export interface CorrelationConfiguration {
  type: "correlation";
  metrics: MetricId[];
  sort?: "name" | "similarity";
}

export interface NetworkConfiguration {
  type: "network";
  size?: MetricId;
  relationship: "adjacency";
}

export interface TreemapConfiguration {
  type: "treemap";
  size: MetricId;
  color?: "region";
}
