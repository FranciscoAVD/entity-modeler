import { add, length, normalize, scale, subtract } from "@/lib/vector3";
import { NODE_RADIUS, orbitRadiusForNodeCount, spaceRadiusForChildren } from "@/scene/bounds";
import type { ModelState } from "@/store/store";
import type { Node, Orbit, Relationship, Space, Vector3 } from "@/store/types";

// Positions are never user-set (plan.md Phase 7) — the only structural lever a user has is
// choosing a parent (creation, or "Move to..."). Every position/origin field is entirely owned
// by this module and recomputed from scratch after any topology change (store.ts's `relayout`).
// A simple damped relaxation (repulsion + spring-along-relationships + centering, position-only,
// no separate velocity state) rather than a real physics integrator or a library — small graphs,
// no animation, "settle to something reasonable once" is the whole requirement.

interface LayoutEntity {
  id: string;
  radius: number;
}
interface LayoutLink {
  a: string;
  b: string;
  weight: number;
}

const ITERATIONS = 200;
const REPULSION_STRENGTH = 6;
const SPRING_STRENGTH = 0.06;
const SPRING_LENGTH = 3;
const CENTERING_STRENGTH = 0.01;
const EPSILON = 0.01;

// Extra breathing room baked into every pair's resting distance, beyond just not overlapping —
// without this, unlinked entities settle right at contact, which reads as "everything huddled in
// one clump" even though nothing is technically overlapping.
const SEPARATION_PADDING = 2.5;

// Every position starts, and every force stays, in the y=0 plane — new objects land on the same
// horizontal plane (panning/zooming across it is much easier to navigate than hunting above or
// below it). This isn't a damping approximation: seeding y=0 for everyone is enough on its own,
// because every force below (repulsion, spring, centering) is computed purely from relative
// positions with no external "up" bias — if every input has y=0, every direction vector derived
// from those positions has y=0 too, so nothing ever pulls an entity off the plane. A flat
// golden-angle *spiral* (not the old full-sphere distribution) keeps that property from the seed
// onward, while still giving each entity a distinct starting point (repulsion has no defined
// direction if two entities start exactly coincident) — deterministic rather than Math.random()
// so layout stays reproducible for the same input, which matters for testing.
function seedPosition(index: number, count: number, spread: number): Vector3 {
  if (count <= 1) return { x: 0, y: 0, z: 0 };
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const theta = goldenAngle * index;
  const ringRadius = Math.sqrt((index + 0.5) / count);
  return scale({ x: Math.cos(theta) * ringRadius, y: 0, z: Math.sin(theta) * ringRadius }, spread);
}

// Aggregates relationships into weighted links between *groups* — nodeToGroup maps every node id
// this layout pass cares about to the entity id it should pull on (itself, for a per-node layout;
// its orbit/space, for a per-group layout one tier up). Relationships with an endpoint outside
// the current tier, or landing on the same group both ends, don't contribute.
function aggregateLinks(nodeToGroup: Map<string, string>, relationships: Iterable<Relationship>): LayoutLink[] {
  const counts = new Map<string, number>();
  for (const r of relationships) {
    const a = nodeToGroup.get(r.sourceId);
    const b = nodeToGroup.get(r.targetId);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, weight]) => {
    const [a, b] = key.split("|");
    return { a, b, weight };
  });
}

// The core primitive, reused at all three tiers (nodes-in-orbit, orbits+ungrouped-nodes-in-space,
// spaces-in-project): settle `entities` relative to each other, optionally clamped within
// `containerRadius` of the group's own local origin (undefined at the project tier, which has no
// parent shell to stay inside).
export function layoutGroup(
  entities: LayoutEntity[],
  links: LayoutLink[],
  containerRadius: number | undefined,
): Map<string, Vector3> {
  const positions = new Map<string, Vector3>();
  if (entities.length === 0) return positions;
  if (entities.length === 1) {
    positions.set(entities[0].id, { x: 0, y: 0, z: 0 });
    return positions;
  }

  // With a container, seed within it. Without one (the project tier, laying out spaces with no
  // parent shell) there's nothing to scale off but the entities themselves — sized by their own
  // total footprint, not merely their count, so a handful of large spaces still starts spread
  // out. (Previously scaled off entities.length alone, which for a handful of spaces produced a
  // seed spread of just 1-2 units against space radii of 2-10+ — everything started deep inside
  // everything else, and the mild repulsion below was never going to undo that on its own.)
  const totalRadius = entities.reduce((sum, e) => sum + e.radius, 0);
  const spread = containerRadius ?? Math.max(totalRadius * 0.6, 4);
  entities.forEach((e, i) => positions.set(e.id, seedPosition(i, entities.length, spread)));

  const radiusById = new Map(entities.map((e) => [e.id, e.radius]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, Vector3>(entities.map((e) => [e.id, { x: 0, y: 0, z: 0 }]));

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i].id;
        const b = entities[j].id;
        const delta = subtract(positions.get(a)!, positions.get(b)!);
        const dist = Math.max(length(delta), EPSILON);
        const minDist = radiusById.get(a)! + radiusById.get(b)! + SEPARATION_PADDING;
        const push = Math.max(minDist - dist, 0) + REPULSION_STRENGTH / (dist * dist);
        const dir = normalize(delta);
        forces.set(a, add(forces.get(a)!, scale(dir, push)));
        forces.set(b, add(forces.get(b)!, scale(dir, -push)));
      }
    }

    for (const link of links) {
      const posA = positions.get(link.a);
      const posB = positions.get(link.b);
      if (!posA || !posB) continue;
      const delta = subtract(posB, posA);
      const dist = Math.max(length(delta), EPSILON);
      const restLength = radiusById.get(link.a)! + radiusById.get(link.b)! + SPRING_LENGTH;
      const pull = (dist - restLength) * SPRING_STRENGTH * link.weight;
      const dir = normalize(delta);
      forces.set(link.a, add(forces.get(link.a)!, scale(dir, pull)));
      forces.set(link.b, add(forces.get(link.b)!, scale(dir, -pull)));
    }

    for (const e of entities) {
      forces.set(e.id, add(forces.get(e.id)!, scale(positions.get(e.id)!, -CENTERING_STRENGTH)));
    }

    // Damping ramps down across iterations so the layout settles rather than oscillating forever.
    const damping = 1 - iter / ITERATIONS;
    for (const e of entities) {
      let next = add(positions.get(e.id)!, scale(forces.get(e.id)!, damping));
      if (containerRadius !== undefined) {
        const maxDist = containerRadius - e.radius;
        if (maxDist > 0 && length(next) > maxDist) next = scale(normalize(next), maxDist);
      }
      positions.set(e.id, next);
    }
  }

  return positions;
}

// Runs the full three-tier cascade for one project and returns updated spaces/orbits/nodes Maps
// (all of them, not just this project's — objects outside `projectId` pass through unchanged) —
// shaped to spread straight into a store `set()` call. Pure function: never touches the store
// itself, so it's independently testable and store.ts stays the only place that decides *when*
// to call it (after every topology-changing mutation, per plan.md's Phase 7 design).
export function autoLayoutProject(
  state: Pick<ModelState, "spaces" | "orbits" | "nodes" | "relationships">,
  projectId: string,
): { spaces: Map<string, Space>; orbits: Map<string, Orbit>; nodes: Map<string, Node> } {
  const spaces = new Map(state.spaces);
  const orbits = new Map(state.orbits);
  const nodes = new Map(state.nodes);

  const projectSpaces = [...spaces.values()].filter((s) => s.projectId === projectId);

  for (const space of projectSpaces) {
    const spaceOrbits = [...orbits.values()].filter((o) => o.spaceId === space.id);

    // Tier 1: nodes within each orbit.
    for (const orbit of spaceOrbits) {
      const orbitNodes = [...nodes.values()].filter((n) => n.orbitId === orbit.id);
      const nodeToGroup = new Map(orbitNodes.map((n) => [n.id, n.id]));
      const positions = layoutGroup(
        orbitNodes.map((n) => ({ id: n.id, radius: NODE_RADIUS })),
        aggregateLinks(nodeToGroup, state.relationships.values()),
        orbitRadiusForNodeCount(orbitNodes.length),
      );
      for (const n of orbitNodes) nodes.set(n.id, { ...n, position: positions.get(n.id) ?? n.position });
    }

    // Tier 2: this space's direct children — each orbit (as one blob) plus each ungrouped node
    // (as an individual point) — laid out together.
    const ungroupedNodes = [...nodes.values()].filter((n) => n.spaceId === space.id && n.orbitId === undefined);
    const orbitRadii = new Map(spaceOrbits.map((o) => [o.id, orbitRadiusForNodeCount(
      [...nodes.values()].filter((n) => n.orbitId === o.id).length,
    )]));
    const spaceRadius = spaceRadiusForChildren([...orbitRadii.values()], ungroupedNodes.length);

    const nodeToGroup = new Map<string, string>();
    for (const orbit of spaceOrbits) {
      for (const n of nodes.values()) if (n.orbitId === orbit.id) nodeToGroup.set(n.id, orbit.id);
    }
    for (const n of ungroupedNodes) nodeToGroup.set(n.id, n.id);

    const tier2Entities: LayoutEntity[] = [
      ...spaceOrbits.map((o) => ({ id: o.id, radius: orbitRadii.get(o.id)! })),
      ...ungroupedNodes.map((n) => ({ id: n.id, radius: NODE_RADIUS })),
    ];
    const tier2Positions = layoutGroup(
      tier2Entities,
      aggregateLinks(nodeToGroup, state.relationships.values()),
      spaceRadius,
    );
    for (const orbit of spaceOrbits) {
      const origin = tier2Positions.get(orbit.id);
      if (origin) orbits.set(orbit.id, { ...orbit, origin });
    }
    for (const n of ungroupedNodes) {
      const position = tier2Positions.get(n.id);
      if (position) nodes.set(n.id, { ...n, position });
    }
  }

  // Tier 3: this project's spaces, unconstrained (no parent shell to stay inside).
  const nodeToSpace = new Map<string, string>();
  for (const space of projectSpaces) {
    for (const n of nodes.values()) if (n.spaceId === space.id) nodeToSpace.set(n.id, space.id);
  }
  const spaceEntities: LayoutEntity[] = projectSpaces.map((s) => {
    const spaceOrbits = [...orbits.values()].filter((o) => o.spaceId === s.id);
    const orbitRadii = spaceOrbits.map((o) =>
      orbitRadiusForNodeCount([...nodes.values()].filter((n) => n.orbitId === o.id).length),
    );
    const ungroupedCount = [...nodes.values()].filter((n) => n.spaceId === s.id && n.orbitId === undefined).length;
    return { id: s.id, radius: spaceRadiusForChildren(orbitRadii, ungroupedCount) };
  });
  const spacePositions = layoutGroup(spaceEntities, aggregateLinks(nodeToSpace, state.relationships.values()), undefined);
  for (const space of projectSpaces) {
    const origin = spacePositions.get(space.id);
    if (origin) spaces.set(space.id, { ...space, origin });
  }

  return { spaces, orbits, nodes };
}
