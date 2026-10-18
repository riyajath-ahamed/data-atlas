import { quadtree, type Quadtree } from "d3-quadtree";

export interface IndexedPoint<T> {
  x: number;
  y: number;
  datum: T;
}

export function buildPointIndex<T>(points: readonly IndexedPoint<T>[]): Quadtree<IndexedPoint<T>> {
  return quadtree<IndexedPoint<T>>()
    .x((point) => point.x)
    .y((point) => point.y)
    .addAll(points as IndexedPoint<T>[]);
}

export function findNearest<T>(index: Quadtree<IndexedPoint<T>>, x: number, y: number, radius: number): T | null {
  return index.find(x, y, radius)?.datum ?? null;
}
