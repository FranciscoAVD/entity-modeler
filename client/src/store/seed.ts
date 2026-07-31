import { useModelStore } from "./store";

// Idempotent so React StrictMode's double-invoked lazy initializer doesn't create duplicates.
export function seedDemoProject(): string {
  const state = useModelStore.getState();
  const existing = [...state.projects.values()].find((p) => p.name === "Demo Project");
  if (existing) return existing.id;

  const { addProject, addSpace, addOrbit, addEntity } = useModelStore.getState();

  const projectId = addProject({ name: "Demo Project" });
  const spaceId = addSpace({ projectId, name: "Space Alpha" });

  const populatedOrbit = addOrbit({ spaceId, name: "Orbit A", origin: { x: 3.5, y: 0, z: 0 } });
  addEntity({ spaceId, orbitId: populatedOrbit, name: "Node 1", position: { x: 1, y: 0.5, z: 0 } });
  addEntity({ spaceId, orbitId: populatedOrbit, name: "Node 2", position: { x: -1, y: -0.5, z: 0.5 } });

  addOrbit({ spaceId, name: "Empty Orbit", origin: { x: -3.5, y: 0, z: 0 } });

  addEntity({ spaceId, name: "Ungrouped Node", position: { x: 0, y: 3, z: -1.5 } });

  return projectId;
}
