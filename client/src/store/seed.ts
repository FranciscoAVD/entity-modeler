import { useModelStore } from "./store";

// Idempotent so React StrictMode's double-invoked lazy initializer doesn't create duplicates.
export function seedDemoProject(): string {
  const state = useModelStore.getState();
  const existing = [...state.projects.values()].find((p) => p.name === "Demo Project");
  if (existing) return existing.id;

  const { addProject, addSpace, addOrbit, addEntity, addRelationship, addNote } =
    useModelStore.getState();

  const projectId = addProject({ name: "Demo Project" });

  const spaceId = addSpace({
    projectId,
    name: "Space Alpha",
    tags: ["prod"],
    metadata: { region: "us-east-1" },
  });
  addNote("space", spaceId, {
    title: "Overview",
    text: "Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
    author: "Alex",
  });
  addNote("space", spaceId, {
    title: "Maintenance window",
    text: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
    author: "Alex",
  });

  const populatedOrbit = addOrbit({
    spaceId,
    name: "Orbit A",
    origin: { x: 3.5, y: 0, z: 0 },
    tags: ["core"],
    metadata: { owner: "platform-team" },
  });
  addNote("orbit", populatedOrbit, {
    title: "Overview",
    text: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.",
  });
  addNote("orbit", populatedOrbit, {
    title: "On-call",
    text: "Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati.",
  });

  const node1 = addEntity({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 1",
    position: { x: 1, y: 0.5, z: 0 },
    tags: ["billing"],
    metadata: { version: "2.3.1" },
  });
  addNote("entity", node1, {
    title: "Purpose",
    text: "Cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.",
  });
  addNote("entity", node1, {
    title: "Known issues",
    text: "Id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.",
  });

  const node2 = addEntity({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 2",
    position: { x: -1, y: -0.5, z: 0.5 },
    tags: ["internal"],
  });

  addOrbit({ spaceId, name: "Empty Orbit", origin: { x: -3.5, y: 0, z: 0 } });

  const ungroupedNode = addEntity({
    spaceId,
    name: "Ungrouped Node",
    position: { x: 0, y: 3, z: -1.5 },
  });
  addNote("entity", ungroupedNode, {
    title: "Pending triage",
    text: "Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. Not yet assigned to an orbit — pending review, see the on-call rotation for follow-up.",
  });
  addNote("entity", ungroupedNode, {
    title: "History",
    text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
  });

  const spaceBeta = addSpace({
    projectId,
    name: "Space Beta",
    origin: { x: 14, y: 0, z: 0 },
    tags: ["external-facing"],
    metadata: { region: "eu-west-1" },
  });
  const remoteNode = addEntity({ spaceId: spaceBeta, name: "Remote Node", tags: ["billing"] });

  addRelationship({ sourceId: node1, targetId: node2, cardinality: "1:N" }); // local (same orbit)
  addRelationship({ sourceId: node1, targetId: ungroupedNode, cardinality: "1:1" }); // cross-orbit
  const crossSpaceRel = addRelationship({
    sourceId: ungroupedNode,
    targetId: remoteNode,
    cardinality: "N:M",
    tags: ["vpn"],
    metadata: { cidr: "10.0.4.0/24", vlan: 12 },
  }); // cross-space
  addNote("relationship", crossSpaceRel, {
    title: "Network path",
    text: "Routed over the site-to-site VPN subnet. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
  });
  addNote("relationship", crossSpaceRel, {
    title: "Change history",
    text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.",
  });

  return projectId;
}
