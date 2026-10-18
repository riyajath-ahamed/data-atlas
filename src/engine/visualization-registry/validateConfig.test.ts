import { describe, expect, it } from "vitest";
import { validateVisualizationConfig } from "./validateConfig.ts";

describe("validateVisualizationConfig", () => {
  it("accepts a scatter configuration and rejects unknown fields and scales", () => {
    const ok = validateVisualizationConfig({
      type: "scatter",
      x: "gdpPerCapita",
      y: "lifeExpectancy",
      size: "population",
      color: "region",
      scale: { x: "log", y: "linear" },
    });
    expect(ok.ok).toBe(true);
    expect(ok.config).toMatchObject({ type: "scatter", scale: { x: "log", y: "linear" } });
    const bad = validateVisualizationConfig({ type: "scatter", x: "gdpPerCapita", y: "lifeExpectancy", scale: { x: "sqrt" }, glow: true });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/sqrt|Unsupported/);
  });

  it("rejects fewer than two correlation metrics", () => {
    expect(validateVisualizationConfig({ type: "correlation", metrics: ["population"] }).ok).toBe(false);
    expect(validateVisualizationConfig({ type: "network", relationship: "trade" }).ok).toBe(false);
  });
});
