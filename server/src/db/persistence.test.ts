import { describe, expect, it } from "bun:test";
import type { ProjectDetail } from "shared";
import { loadProjectDetail, loadProjectList } from "./reads";
import { seedIfEmpty } from "./seed";
import { deleteProject, upsertProject } from "./writes";

// Runs against an isolated in-memory DB (see package.json's `test` script: DB_FILE=:memory:),
// not the real dev database — every test below uses its own randomUUID()'d project id so they
// can safely share that one in-memory DB across the whole file without interfering.

function minimalProject(id: string, overrides?: Partial<ProjectDetail>): ProjectDetail {
  return {
    project: { id, name: "Test Project" },
    spaces: [],
    relationships: [],
    tags: [],
    ...overrides,
  };
}

describe("seedIfEmpty", () => {
  it("populates the demo project when the DB is empty, and is a no-op once it isn't", async () => {
    seedIfEmpty();
    const afterFirstSeed = await loadProjectList();
    expect(afterFirstSeed.length).toBeGreaterThanOrEqual(1);

    const demo = afterFirstSeed.find((p) => p.name === "Demo Project");
    expect(demo).toBeDefined();

    seedIfEmpty();
    const afterSecondSeed = await loadProjectList();
    expect(afterSecondSeed.length).toBe(afterFirstSeed.length);
  });
});

describe("upsertProject / loadProjectDetail round-trip", () => {
  it("preserves the full nested tree — spaces, orbits, ungrouped nodes, relationships, tags, notes, and metadata", async () => {
    const id = crypto.randomUUID();
    const spaceId = crypto.randomUUID();
    const orbitId = crypto.randomUUID();
    const nodeInOrbitId = crypto.randomUUID();
    const ungroupedNodeId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    const relId = crypto.randomUUID();

    const data = minimalProject(id, {
      tags: [{ id: tagId, projectId: id, name: "prod" }],
      spaces: [
        {
          id: spaceId,
          projectId: id,
          name: "Space A",
          origin: { x: 1, y: 2, z: 3 },
          tagIds: [tagId],
          notes: [{ id: crypto.randomUUID(), title: "N", text: "hello", createdAt: 123 }],
          metadata: { region: "us-east-1" },
          orbits: [
            {
              id: orbitId,
              spaceId,
              name: "Orbit A",
              origin: { x: 0.5, y: 0, z: 0 },
              tagIds: [],
              notes: [],
              nodes: [
                {
                  id: nodeInOrbitId,
                  spaceId,
                  orbitId,
                  name: "Node A",
                  position: { x: 1, y: 1, z: 1 },
                  tagIds: [tagId],
                  notes: [],
                  metadata: { version: "1.0" },
                },
              ],
            },
          ],
          ungroupedNodes: [
            {
              id: ungroupedNodeId,
              spaceId,
              name: "Ungrouped",
              position: { x: -1, y: 0, z: 0 },
              tagIds: [],
              notes: [],
            },
          ],
        },
      ],
      relationships: [
        {
          id: relId,
          sourceId: nodeInOrbitId,
          targetId: ungroupedNodeId,
          cardinality: "N:M",
          tagIds: [tagId],
          notes: [],
          metadata: { cidr: "10.0.0.0/24" },
        },
      ],
    });

    upsertProject(id, data);
    const loaded = await loadProjectDetail(id);

    expect(loaded).toEqual(data);
  });

  it("replaces rather than merges — re-upserting with a renamed node and a removed relationship leaves no stale rows", async () => {
    const id = crypto.randomUUID();
    const spaceId = crypto.randomUUID();
    const nodeAId = crypto.randomUUID();
    const nodeBId = crypto.randomUUID();

    const original = minimalProject(id, {
      spaces: [
        {
          id: spaceId,
          projectId: id,
          name: "Space A",
          origin: { x: 0, y: 0, z: 0 },
          tagIds: [],
          notes: [],
          orbits: [],
          ungroupedNodes: [
            { id: nodeAId, spaceId, name: "Node A", position: { x: 0, y: 0, z: 0 }, tagIds: [], notes: [] },
            { id: nodeBId, spaceId, name: "Node B", position: { x: 1, y: 0, z: 0 }, tagIds: [], notes: [] },
          ],
        },
      ],
      relationships: [
        {
          id: crypto.randomUUID(),
          sourceId: nodeAId,
          targetId: nodeBId,
          cardinality: "1:1",
          tagIds: [],
          notes: [],
        },
      ],
    });
    upsertProject(id, original);

    const replacement = minimalProject(id, {
      spaces: [
        {
          id: spaceId,
          projectId: id,
          name: "Space A",
          origin: { x: 0, y: 0, z: 0 },
          tagIds: [],
          notes: [],
          orbits: [],
          ungroupedNodes: [
            { id: nodeAId, spaceId, name: "Node A Renamed", position: { x: 0, y: 0, z: 0 }, tagIds: [], notes: [] },
          ],
        },
      ],
      relationships: [],
    });
    upsertProject(id, replacement);

    const loaded = await loadProjectDetail(id);
    expect(loaded?.spaces[0]?.ungroupedNodes).toHaveLength(1);
    expect(loaded?.spaces[0]?.ungroupedNodes[0]?.name).toBe("Node A Renamed");
    expect(loaded?.relationships).toHaveLength(0);
  });

  it("returns undefined for a project id that doesn't exist", async () => {
    expect(await loadProjectDetail(crypto.randomUUID())).toBeUndefined();
  });

  it("orders the project list by name, not save order — re-saving a project must not move it", async () => {
    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    const idC = crypto.randomUUID();
    upsertProject(idA, minimalProject(idA, { project: { id: idA, name: "Zebra" } }));
    upsertProject(idB, minimalProject(idB, { project: { id: idB, name: "Apple" } }));
    upsertProject(idC, minimalProject(idC, { project: { id: idC, name: "Mango" } }));

    // Regression case: upsertProject deletes and reinserts the projects row itself (to let the
    // FK cascade clear its children), which used to give it a new rowid and move it to the end
    // of an unordered scan — re-saving "Zebra" here must not change its alphabetical position.
    upsertProject(idA, minimalProject(idA, { project: { id: idA, name: "Zebra" } }));

    const ids = new Set<string>([idA, idB, idC]);
    const names = (await loadProjectList()).filter((p) => ids.has(p.id)).map((p) => p.name);
    expect(names).toEqual(["Apple", "Mango", "Zebra"]);
  });
});

describe("deleteProject", () => {
  it("removes the project and everything scoped to it; returns false for an already-gone id", async () => {
    const id = crypto.randomUUID();
    upsertProject(id, minimalProject(id));

    expect(deleteProject(id)).toBe(true);
    expect(await loadProjectDetail(id)).toBeUndefined();
    expect((await loadProjectList()).some((p) => p.id === id)).toBe(false);

    expect(deleteProject(id)).toBe(false);
  });
});
