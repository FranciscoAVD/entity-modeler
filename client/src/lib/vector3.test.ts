import { describe, expect, it } from "bun:test";
import { add, cross, length, midpoint, normalize, scale, subtract } from "./vector3";

describe("vector3", () => {
  it("adds and subtracts componentwise", () => {
    expect(add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 });
    expect(subtract({ x: 4, y: 5, z: 6 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 3, y: 3, z: 3 });
  });

  it("scales componentwise", () => {
    expect(scale({ x: 1, y: -2, z: 3 }, 2)).toEqual({ x: 2, y: -4, z: 6 });
  });

  it("computes the cross product", () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("computes length", () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBe(5);
  });

  it("normalizes to unit length", () => {
    const n = normalize({ x: 3, y: 4, z: 0 });
    expect(length(n)).toBeCloseTo(1);
  });

  it("leaves a zero vector unchanged when normalizing", () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("computes the midpoint", () => {
    expect(midpoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});
