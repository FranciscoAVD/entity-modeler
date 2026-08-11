import { describe, expect, it } from "bun:test";
import { length, subtract } from "@/lib/vector3";
import type { Node, Orbit, Relationship, Space } from "@/store/types";
import { autoLayoutProject, layoutGroup } from "./autoLayout";
import { NODE_RADIUS, orbitRadiusForNodeCount, spaceRadiusForChildren } from "./bounds";

const ORIGIN = { x: 0, y: 0, z: 0 };

function space(id: string, projectId: string): Space {
  return { id, projectId, name: id, origin: ORIGIN, tagIds: [], notes: [] };
}
function orbit(id: string, spaceId: string): Orbit {
  return { id, spaceId, name: id, origin: ORIGIN, tagIds: [], notes: [] };
}
function node(id: string, spaceId: string, orbitId?: string): Node {
  return { id, spaceId, orbitId, name: id, tagIds: [], position: ORIGIN, notes: [] };
}
function relationship(id: string, sourceId: string, targetId: string): Relationship {
  return { id, sourceId, targetId, cardinality: "1:1", tagIds: [], notes: [] };
}

describe("layoutGroup", () => {
  it("returns nothing for an empty group", () => {
    expect(layoutGroup([], [], 10).size).toBe(0);
  });

  it("places a single entity at the group's own center", () => {
    const positions = layoutGroup([{ id: "a", radius: 1 }], [], 10);
    expect(positions.get("a")).toEqual(ORIGIN);
  });

  it("keeps every entity within the container radius", () => {
    const entities = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, radius: 0.6 }));
    const containerRadius = 6;
    const positions = layoutGroup(entities, [], containerRadius);

    for (const e of entities) {
      const pos = positions.get(e.id)!;
      expect(length(pos)).toBeLessThanOrEqual(containerRadius - e.radius + 1e-6);
    }
  });

  it("settles connected entities closer together than unconnected ones", () => {
    const entities = [
      { id: "a", radius: 0.6 },
      { id: "b", radius: 0.6 },
      { id: "c", radius: 0.6 },
    ];
    // a-b are linked, c is isolated — a-b should end up closer to each other than to c.
    const links = [{ a: "a", b: "b", weight: 1 }];
    const positions = layoutGroup(entities, links, 20);

    const distAB = length(subtract(positions.get("a")!, positions.get("b")!));
    const distAC = length(subtract(positions.get("a")!, positions.get("c")!));
    const distBC = length(subtract(positions.get("b")!, positions.get("c")!));

    expect(distAB).toBeLessThan(distAC);
    expect(distAB).toBeLessThan(distBC);
  });

  it("keeps unconnected entities from all collapsing onto the same point", () => {
    const entities = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, radius: 0.6 }));
    const positions = layoutGroup(entities, [], undefined);

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const dist = length(subtract(positions.get(entities[i].id)!, positions.get(entities[j].id)!));
        expect(dist).toBeGreaterThan(entities[i].radius + entities[j].radius);
      }
    }
  });
});

describe("autoLayoutProject", () => {
  it("positions nodes within their orbit's radius", () => {
    const spaceId = "s1";
    const orbitId = "o1";
    const state = {
      spaces: new Map([[spaceId, space(spaceId, "p1")]]),
      orbits: new Map([[orbitId, orbit(orbitId, spaceId)]]),
      nodes: new Map(
        Array.from({ length: 8 }, (_, i) => [`n${i}`, node(`n${i}`, spaceId, orbitId)] as const),
      ),
      relationships: new Map<string, Relationship>(),
    };

    const result = autoLayoutProject(state, "p1");
    const containerRadius = orbitRadiusForNodeCount(8);

    for (const n of result.nodes.values()) {
      // Node.position is local to the orbit's own origin, per plan.md's position-resolution rule.
      expect(length(n.position)).toBeLessThanOrEqual(containerRadius - NODE_RADIUS + 1e-6);
    }
  });

  it("pulls two orbits closer together when their nodes are related than two with no relationship", () => {
    const spaceId = "s1";
    const state = {
      spaces: new Map([[spaceId, space(spaceId, "p1")]]),
      orbits: new Map([
        ["oa", orbit("oa", spaceId)],
        ["ob", orbit("ob", spaceId)],
        ["oc", orbit("oc", spaceId)],
      ]),
      nodes: new Map([
        ["na", node("na", spaceId, "oa")],
        ["nb", node("nb", spaceId, "ob")],
        ["nc", node("nc", spaceId, "oc")],
      ]),
      relationships: new Map([["r1", relationship("r1", "na", "nb")]]),
    };

    const result = autoLayoutProject(state, "p1");
    const distAB = length(subtract(result.orbits.get("oa")!.origin, result.orbits.get("ob")!.origin));
    const distAC = length(subtract(result.orbits.get("oa")!.origin, result.orbits.get("oc")!.origin));

    expect(distAB).toBeLessThan(distAC);
  });

  it("leaves objects outside the given project untouched", () => {
    const state = {
      spaces: new Map([
        ["s1", space("s1", "p1")],
        ["s2", { ...space("s2", "p2"), origin: { x: 42, y: 7, z: -3 } }],
      ]),
      orbits: new Map<string, Orbit>(),
      nodes: new Map<string, Node>(),
      relationships: new Map<string, Relationship>(),
    };

    const result = autoLayoutProject(state, "p1");
    expect(result.spaces.get("s2")).toEqual(state.spaces.get("s2"));
  });

  it("positions ungrouped nodes directly within their space, alongside any orbits", () => {
    const spaceId = "s1";
    const state = {
      spaces: new Map([[spaceId, space(spaceId, "p1")]]),
      orbits: new Map([["o1", orbit("o1", spaceId)]]),
      nodes: new Map([
        ["ungrouped", node("ungrouped", spaceId)],
        ["grouped", node("grouped", spaceId, "o1")],
      ]),
      relationships: new Map<string, Relationship>(),
    };

    const result = autoLayoutProject(state, "p1");
    // Both are direct children of the space (an ungrouped node's position is local to the space,
    // same as an orbit's origin), laid out together — so they shouldn't collide with each other,
    // and both should stay within the space's own radius.
    const ungrouped = result.nodes.get("ungrouped")!.position;
    const orbitOrigin = result.orbits.get("o1")!.origin;
    const orbitRadius = orbitRadiusForNodeCount(1);
    const spaceRadius = spaceRadiusForChildren([orbitRadius], 1);

    expect(length(subtract(ungrouped, orbitOrigin))).toBeGreaterThan(orbitRadius + NODE_RADIUS);
    expect(length(ungrouped)).toBeLessThanOrEqual(spaceRadius - NODE_RADIUS + 1e-6);
    expect(length(orbitOrigin)).toBeLessThanOrEqual(spaceRadius - orbitRadius + 1e-6);
  });
});
