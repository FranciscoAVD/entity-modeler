import { nodesInOrbit, orbitsInSpace, ungroupedNodesInSpace } from "@/store/selectors";
import type { ModelState } from "@/store/store";

// Never render a group too small to see or click, per plan.md's empty-state rule.
export const MIN_BOUNDARY_RADIUS = 2;

// Lives here (not Node.tsx, which re-exports it) rather than a plain-React component file — this
// module has zero React/R3F dependency, and autoLayout.ts (imported from store.ts) needs the same
// radius rendering uses without pulling a scene component into the store's dependency graph
// (plan.md decision #5: the data layer stays separate from the renderer).
export const NODE_RADIUS = 0.6;

// Orbit size is driven by how many nodes it holds, not by their positions — so auto-layout
// (autoLayout.ts) can move a node around without also resizing its container. sqrt keeps growth
// from running away as the count climbs. Split out from computeOrbitRadius as a plain
// count -> radius function (rather than inlined) so autoLayout.ts's containment/collision radii
// come from the exact same formula the rendered boundary sphere uses, without needing a full
// ModelState just to re-derive a count it already has on hand.
const ORBIT_RADIUS_PER_NODE = 1.1;

export function orbitRadiusForNodeCount(count: number): number {
  return MIN_BOUNDARY_RADIUS + ORBIT_RADIUS_PER_NODE * Math.sqrt(count);
}

export function computeOrbitRadius(state: ModelState, orbitId: string): number {
  return orbitRadiusForNodeCount(nodesInOrbit(state, orbitId).length);
}

// Space size is driven by how many orbits/ungrouped nodes it holds. Orbits contribute
// their own (already count-driven) radius rather than a flat weight, so a space with a
// heavily-populated orbit still grows enough to visually contain it. Same split as above.
const SPACE_RADIUS_SCALE = 2.2;
const UNGROUPED_NODE_WEIGHT = 1.1;

export function spaceRadiusForChildren(orbitRadii: number[], ungroupedCount: number): number {
  const weight = orbitRadii.reduce((sum, r) => sum + r, 0) + ungroupedCount * UNGROUPED_NODE_WEIGHT;
  return MIN_BOUNDARY_RADIUS + Math.sqrt(weight) * SPACE_RADIUS_SCALE;
}

export function computeSpaceRadius(state: ModelState, spaceId: string): number {
  const orbitRadii = orbitsInSpace(state, spaceId).map((o) => computeOrbitRadius(state, o.id));
  const ungroupedCount = ungroupedNodesInSpace(state, spaceId).length;
  return spaceRadiusForChildren(orbitRadii, ungroupedCount);
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
