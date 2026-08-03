import { useModelStore } from "./store";

// Idempotent so React StrictMode's double-invoked lazy initializer doesn't create duplicates.
export function seedDemoProject(): string {
  const state = useModelStore.getState();
  const existing = [...state.projects.values()].find((p) => p.name === "Demo Project");
  if (existing) return existing.id;

  const { addProject, addSpace, addOrbit, addEntity, addRelationship } = useModelStore.getState();

  const projectId = addProject({ name: "Demo Project" });
  const spaceId = addSpace({ projectId, name: "Space Alpha", tags: ["prod"] });

  const populatedOrbit = addOrbit({
    spaceId,
    name: "Orbit A",
    origin: { x: 3.5, y: 0, z: 0 },
    tags: ["core"],
  });
  const node1 = addEntity({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 1",
    position: { x: 1, y: 0.5, z: 0 },
    fields: [
      { id: crypto.randomUUID(), name: "id", type: "uuid" },
      { id: crypto.randomUUID(), name: "email", type: "string" },
    ],
  });
  const node2 = addEntity({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 2",
    position: { x: -1, y: -0.5, z: 0.5 },
    fields: [
      { id: crypto.randomUUID(), name: "id", type: "uuid" },
      { id: crypto.randomUUID(), name: "node1_id", type: "uuid" },
    ],
  });

  addOrbit({ spaceId, name: "Empty Orbit", origin: { x: -3.5, y: 0, z: 0 } });

  const ungroupedNode = addEntity({
    spaceId,
    name: "Ungrouped Node",
    position: { x: 0, y: 3, z: -1.5 },
    fields: [{ id: crypto.randomUUID(), name: "id", type: "uuid" }],
  });

  const spaceBeta = addSpace({
    projectId,
    name: "Space Beta",
    origin: { x: 14, y: 0, z: 0 },
    tags: ["external-facing"],
  });
  const remoteNode = addEntity({
    spaceId: spaceBeta,
    name: "Remote Node",
    fields: [
      { id: crypto.randomUUID(), name: "id", type: "uuid" },
      { id: crypto.randomUUID(), name: "ungrouped_node_id", type: "uuid" },
    ],
  });

  addRelationship({ sourceId: node1, targetId: node2, cardinality: "1:N" }); // local (same orbit)
  addRelationship({ sourceId: node1, targetId: ungroupedNode, cardinality: "1:1" }); // cross-orbit
  addRelationship({ sourceId: ungroupedNode, targetId: remoteNode, cardinality: "N:M" }); // cross-space

  return projectId;
}
