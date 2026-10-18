import type { ComponentType } from "react";
import type { VisualizationConfig } from "./types.ts";

export interface VisualizationModule {
  type: VisualizationConfig["type"];
  title: string;
}

const modules: VisualizationModule[] = [
  { type: "scatter", title: "Multidimensional scatter" },
  { type: "choropleth", title: "Geographic explorer" },
  { type: "timeline", title: "Temporal explorer" },
  { type: "correlation", title: "Correlation analysis" },
  { type: "network", title: "Relationship explorer" },
  { type: "treemap", title: "Hierarchical explorer" },
];

export function visualizationModule(type: VisualizationConfig["type"]): VisualizationModule | undefined {
  return modules.find((module) => module.type === type);
}

export function registeredTypes(): VisualizationConfig["type"][] {
  return modules.map((module) => module.type);
}

export type ChartComponent = ComponentType<{ config: VisualizationConfig }>;
