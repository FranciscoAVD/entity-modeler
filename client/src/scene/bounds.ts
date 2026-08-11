import { nodesInOrbit, orbitsInSpace, ungroupedNodesInSpace } from "@/store/selectors";
import type { ModelState } from "@/store/store";

// Never render a group too small to see or click, per plan.md's empty-state rule.
export const MIN_BOUNDARY_RADIUS = 2;

// Orbit size is driven by how many nodes it holds, not by their positions — so dragging
// (or any future auto-layout) can move a node around without also resizing its container.
// sqrt keeps growth from running away as the count climbs.
const ORBIT_RADIUS_PER_NODE = 1.1;

export function computeOrbitRadius(state: ModelState, orbitId: string): number {
  const count = nodesInOrbit(state, orbitId).length;
  return MIN_BOUNDARY_RADIUS + ORBIT_RADIUS_PER_NODE * Math.sqrt(count);
}

// Space size is driven by how many orbits/ungrouped nodes it holds. Orbits contribute
// their own (already count-driven) radius rather than a flat weight, so a space with a
// heavily-populated orbit still grows enough to visually contain it.
const SPACE_RADIUS_SCALE = 2.2;
const UNGROUPED_NODE_WEIGHT = 1.1;

export function computeSpaceRadius(state: ModelState, spaceId: string): number {
  const orbits = orbitsInSpace(state, spaceId);
  const ungroupedCount = ungroupedNodesInSpace(state, spaceId).length;

  const orbitWeight = orbits.reduce((sum, o) => sum + computeOrbitRadius(state, o.id), 0);
  const weight = orbitWeight + ungroupedCount * UNGROUPED_NODE_WEIGHT;

  return MIN_BOUNDARY_RADIUS + Math.sqrt(weight) * SPACE_RADIUS_SCALE;
}

// A space with an (even empty) orbit is still visually populated by that orbit's sphere.
export function isSpaceEmpty(state: ModelState, spaceId: string): boolean {
  const hasOrbits = orbitsInSpace(state, spaceId).length > 0;
  const hasUngroupedNodes = ungroupedNodesInSpace(state, spaceId).length > 0;
  return !hasOrbits && !hasUngroupedNodes;
}

export function isOrbitEmpty(state: ModelState, orbitId: string): boolean {
  return nodesInOrbit(state, orbitId).length === 0;
}
