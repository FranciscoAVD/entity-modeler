import { describe, expect, it } from "bun:test";
import { length, subtract } from "@/lib/vector3";
import { computeEdgeControlPoint, trimEdgeEndpoints } from "./edgeGeometry";

describe("computeEdgeControlPoint", () => {
  it("offsets perpendicular to the start->end direction", () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 10, y: 0, z: 0 };
    const control = computeEdgeControlPoint(start, end);
    const direction = subtract(end, start);
    const toControl = subtract(control, { x: (start.x + end.x) / 2, y: 0, z: 0 });

    const dot = direction.x * toControl.x + direction.y * toControl.y + direction.z * toControl.z;
    expect(dot).toBeCloseTo(0);
    expect(length(toControl)).toBeGreaterThan(0);
  });

  it("scales the offset with distance", () => {
    const shortOffset = length(
      subtract(computeEdgeControlPoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }), { x: 1, y: 0, z: 0 }),
    );
    const longOffset = length(
      subtract(computeEdgeControlPoint({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }), { x: 10, y: 0, z: 0 }),
    );
    expect(longOffset).toBeGreaterThan(shortOffset);
  });

  it("doesn't blow up for coincident points", () => {
    const point = { x: 1, y: 2, z: 3 };
    expect(computeEdgeControlPoint(point, point)).toEqual(point);
  });
});

describe("trimEdgeEndpoints", () => {
  it("pulls each endpoint back toward the control point by radius", () => {
    const start = { x: 0, y: 0, z: 0 };
    const control = { x: 5, y: 0, z: 0 };
    const end = { x: 10, y: 0, z: 0 };

    const trimmed = trimEdgeEndpoints(start, control, end, 1);
    expect(trimmed.start).toEqual({ x: 1, y: 0, z: 0 });
    expect(trimmed.end).toEqual({ x: 9, y: 0, z: 0 });
  });

  it("leaves an endpoint untouched when it's too close to the control point to safely trim", () => {
    const start = { x: 0, y: 0, z: 0 };
    const control = { x: 0.5, y: 0, z: 0 };
    const end = { x: 10, y: 0, z: 0 };

    const trimmed = trimEdgeEndpoints(start, control, end, 1);
    expect(trimmed.start).toEqual(start);
  });
});
