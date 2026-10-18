import { METRIC_IDS, type MetricId } from "../../data/schemas/types.ts";
import type { VisualizationConfig } from "./types.ts";

const SCALES = new Set(["linear", "log"]);
const SCHEMES = new Set(["sequential", "diverging"]);
const REPRESENTATIONS = new Set(["line", "area"]);
const SORTS = new Set(["name", "similarity"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetric(value: unknown): value is MetricId {
  return typeof value === "string" && (METRIC_IDS as readonly string[]).includes(value);
}

function unknownKeys(record: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(record).filter((key) => !allowed.includes(key));
}

export interface ConfigValidation {
  ok: boolean;
  errors: string[];
  config: VisualizationConfig | null;
}

export function validateVisualizationConfig(input: unknown): ConfigValidation {
  if (!isRecord(input) || typeof input.type !== "string") {
    return { ok: false, errors: ["Configuration must be an object with a type."], config: null };
  }
  switch (input.type) {
    case "scatter":
      return validateScatter(input);
    case "choropleth":
      return validateChoropleth(input);
    case "timeline":
      return validateTimeline(input);
    case "correlation":
      return validateCorrelation(input);
    case "network":
      return validateNetwork(input);
    case "treemap":
      return validateTreemap(input);
    default:
      return { ok: false, errors: [`Unsupported visualization type "${input.type}".`], config: null };
  }
}

function fail(errors: string[]): ConfigValidation {
  return { ok: false, errors, config: null };
}

function validateScatter(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "x", "y", "size", "color", "scale", "interaction", "opacity", "regression"]);
  if (extra.length) errors.push(`Unsupported scatter fields: ${extra.join(", ")}.`);
  if (!isMetric(input.x)) errors.push("Scatter x must be a known metric.");
  if (!isMetric(input.y)) errors.push("Scatter y must be a known metric.");
  if (input.size !== undefined && !isMetric(input.size)) errors.push("Scatter size must be a known metric.");
  if (input.color !== undefined && input.color !== "region") errors.push('Scatter color only supports "region".');
  if (input.opacity !== undefined && (typeof input.opacity !== "number" || input.opacity <= 0 || input.opacity > 1)) {
    errors.push("Scatter opacity must be between 0 and 1.");
  }
  if (input.regression !== undefined && typeof input.regression !== "boolean") errors.push("Scatter regression must be boolean.");
  if (input.scale !== undefined) {
    if (!isRecord(input.scale)) errors.push("Scatter scale must be an object.");
    else {
      const scaleExtra = unknownKeys(input.scale, ["x", "y"]);
      if (scaleExtra.length) errors.push(`Unsupported scale fields: ${scaleExtra.join(", ")}.`);
      if (input.scale.x !== undefined && !SCALES.has(String(input.scale.x))) errors.push('Scale x must be "linear" or "log".');
      if (input.scale.y !== undefined && !SCALES.has(String(input.scale.y))) errors.push('Scale y must be "linear" or "log".');
    }
  }
  if (input.interaction !== undefined) {
    if (!isRecord(input.interaction)) errors.push("Scatter interaction must be an object.");
    else {
      const interactionExtra = unknownKeys(input.interaction, ["brush", "zoom", "selection"]);
      if (interactionExtra.length) errors.push(`Unsupported interaction fields: ${interactionExtra.join(", ")}.`);
      for (const key of ["brush", "zoom", "selection"] as const) {
        if (input.interaction[key] !== undefined && typeof input.interaction[key] !== "boolean") {
          errors.push(`Interaction ${key} must be boolean.`);
        }
      }
    }
  }
  if (errors.length || !isMetric(input.x) || !isMetric(input.y)) return fail(errors);
  const scale = isRecord(input.scale) ? input.scale : {};
  const interaction = isRecord(input.interaction) ? input.interaction : {};
  return {
    ok: true,
    errors: [],
    config: {
      type: "scatter",
      x: input.x,
      y: input.y,
      size: isMetric(input.size) ? input.size : undefined,
      color: input.color === "region" ? "region" : undefined,
      scale: {
        x: scale.x === "log" ? "log" : "linear",
        y: scale.y === "log" ? "log" : "linear",
      },
      interaction: {
        brush: interaction.brush !== false,
        zoom: interaction.zoom !== false,
        selection: interaction.selection !== false,
      },
      opacity: typeof input.opacity === "number" ? input.opacity : 0.85,
      regression: input.regression === true,
    },
  };
}

function validateChoropleth(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "metric", "scheme"]);
  if (extra.length) errors.push(`Unsupported choropleth fields: ${extra.join(", ")}.`);
  if (!isMetric(input.metric)) errors.push("Choropleth metric must be a known metric.");
  if (input.scheme !== undefined && !SCHEMES.has(String(input.scheme))) errors.push('Scheme must be "sequential" or "diverging".');
  if (errors.length || !isMetric(input.metric)) return fail(errors);
  return {
    ok: true,
    errors: [],
    config: {
      type: "choropleth",
      metric: input.metric,
      scheme: input.scheme === "diverging" ? "diverging" : "sequential",
    },
  };
}

function validateTimeline(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "metric", "representation"]);
  if (extra.length) errors.push(`Unsupported timeline fields: ${extra.join(", ")}.`);
  if (!isMetric(input.metric)) errors.push("Timeline metric must be a known metric.");
  if (input.representation !== undefined && !REPRESENTATIONS.has(String(input.representation))) {
    errors.push('Representation must be "line" or "area".');
  }
  if (errors.length || !isMetric(input.metric)) return fail(errors);
  return {
    ok: true,
    errors: [],
    config: {
      type: "timeline",
      metric: input.metric,
      representation: input.representation === "area" ? "area" : "line",
    },
  };
}

function validateCorrelation(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "metrics", "sort"]);
  if (extra.length) errors.push(`Unsupported correlation fields: ${extra.join(", ")}.`);
  if (!Array.isArray(input.metrics) || input.metrics.length < 2 || !input.metrics.every(isMetric)) {
    errors.push("Correlation metrics must be an array of at least two known metrics.");
  }
  if (input.sort !== undefined && !SORTS.has(String(input.sort))) errors.push('Sort must be "name" or "similarity".');
  if (errors.length || !Array.isArray(input.metrics) || !input.metrics.every(isMetric)) return fail(errors);
  return {
    ok: true,
    errors: [],
    config: {
      type: "correlation",
      metrics: input.metrics,
      sort: input.sort === "similarity" ? "similarity" : "name",
    },
  };
}

function validateNetwork(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "size", "relationship"]);
  if (extra.length) errors.push(`Unsupported network fields: ${extra.join(", ")}.`);
  if (input.relationship !== "adjacency") errors.push('Network relationship only supports "adjacency".');
  if (input.size !== undefined && !isMetric(input.size)) errors.push("Network size must be a known metric.");
  if (errors.length) return fail(errors);
  return {
    ok: true,
    errors: [],
    config: { type: "network", relationship: "adjacency", size: isMetric(input.size) ? input.size : "population" },
  };
}

function validateTreemap(input: Record<string, unknown>): ConfigValidation {
  const errors: string[] = [];
  const extra = unknownKeys(input, ["type", "size", "color"]);
  if (extra.length) errors.push(`Unsupported treemap fields: ${extra.join(", ")}.`);
  if (!isMetric(input.size)) errors.push("Treemap size must be a known metric.");
  if (input.color !== undefined && input.color !== "region") errors.push('Treemap color only supports "region".');
  if (errors.length || !isMetric(input.size)) return fail(errors);
  return { ok: true, errors: [], config: { type: "treemap", size: input.size, color: "region" } };
}
