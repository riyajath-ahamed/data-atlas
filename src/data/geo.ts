import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature, neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CountryMetadata } from "../data/schemas/types.ts";

export type WorldTopology = Topology<{ countries: GeometryCollection }>;

export interface CountryShape {
  countryCode: string | null;
  feature: Feature<Geometry | null>;
}

export interface AdjacencyLink {
  source: string;
  target: string;
}

export function countryShapes(topology: WorldTopology, countries: readonly CountryMetadata[]): CountryShape[] {
  const byNumeric = new Map(
    countries
      .filter((country) => country.isoNumeric)
      .map((country) => [Number(country.isoNumeric), country.countryCode]),
  );
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<Geometry | null>;
  return collection.features.map((shape) => ({
    feature: shape,
    countryCode: byNumeric.get(Number(shape.id)) ?? null,
  }));
}

/** Undirected shared-border links from Natural Earth, via topojson.neighbors. */
export function adjacencyLinks(topology: WorldTopology, countries: readonly CountryMetadata[]): AdjacencyLink[] {
  const byNumeric = new Map(
    countries
      .filter((country) => country.isoNumeric)
      .map((country) => [Number(country.isoNumeric), country.countryCode]),
  );
  const geometries = topology.objects.countries.geometries;
  const codes = geometries.map((geometry) => byNumeric.get(Number(geometry.id)) ?? null);
  const links: AdjacencyLink[] = [];
  neighbors(geometries).forEach((adjacent, index) => {
    const source = codes[index];
    if (!source) return;
    for (const neighborIndex of adjacent) {
      const target = codes[neighborIndex];
      if (!target || source >= target) continue;
      links.push({ source, target });
    }
  });
  return links;
}
