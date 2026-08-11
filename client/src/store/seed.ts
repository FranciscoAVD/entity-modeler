import { useModelStore } from "./store";

// Idempotent so React StrictMode's double-invoked lazy initializer doesn't create duplicates.
export function seedDemoProject(): string {
  const state = useModelStore.getState();
  const existing = [...state.projects.values()].find((p) => p.name === "Demo Project");
  if (existing) return existing.id;

  const { addProject, addSpace, addOrbit, addNode, addRelationship, addNote } =
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
    text: "## Space Alpha\n\nProduction space for the billing and identity stack. Hosts two orbits:\n\n- **Orbit A** — core services, actively maintained\n- **Empty Orbit** — reserved for the upcoming payments split\n\nRegion is `us-east-1`. See the [runbook](https://example.com/runbooks/space-alpha) before making changes.",
    author: "Alex",
  });
  addNote("space", spaceId, {
    title: "Maintenance window",
    text: "Standard maintenance window is **Sundays 02:00–04:00 UTC**.\n\n1. Announce in `#platform-changes` 24h ahead\n2. Drain traffic from the affected orbit\n3. Apply changes, then verify health checks\n\n> Skipping step 1 caused a paging incident in March — don't skip step 1.",
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
    text: "### Orbit A\n\nOwned by the `platform-team`. Groups the core billing nodes:\n\n- Node 1 — primary billing service\n- Node 2 — internal support service\n\n---\n\nChanges here require a review from platform-team before merge.",
  });
  addNote("orbit", populatedOrbit, {
    title: "On-call",
    text: "Current rotation:\n\n1. **Primary** — Jordan\n2. **Secondary** — Priya\n3. **Escalation** — Alex\n\nPage via `pagerduty:orbit-a`. For non-urgent issues, open a ticket instead — see the [on-call guide](https://example.com/runbooks/on-call).",
  });

  const node1 = addNode({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 1",
    position: { x: 1, y: 0.5, z: 0 },
    tags: ["billing"],
    metadata: { version: "2.3.1" },
  });
  addNote("node", node1, {
    title: "Purpose",
    text: "Handles billing invoice generation and dunning. Reads from `orders` and writes to `invoices`.\n\nDeployed as a single service, version `2.3.1`. Scales horizontally behind the internal load balancer — see the [architecture doc](https://example.com/docs/node-1-architecture) for the full request path.",
  });
  addNote("node", node1, {
    title: "Known issues",
    text: "- Retry storm under `>500 req/s` on the `/invoices` endpoint — tracked, fix targeted for next release\n- Occasional clock drift causes duplicate dunning emails\n\n> Workaround: restart the service if duplicate emails are reported; root cause is still open.",
  });

  const node2 = addNode({
    spaceId,
    orbitId: populatedOrbit,
    name: "Node 2",
    position: { x: -1, y: -0.5, z: 0.5 },
    tags: ["internal"],
  });

  addOrbit({ spaceId, name: "Empty Orbit", origin: { x: -3.5, y: 0, z: 0 } });

  const ungroupedNode = addNode({
    spaceId,
    name: "Ungrouped Node",
    position: { x: 0, y: 3, z: -1.5 },
  });
  addNote("node", ungroupedNode, {
    title: "Pending triage",
    text: "**Not yet assigned to an orbit** — pending review.\n\nCandidate homes:\n\n- Orbit A, if it turns out to be billing-adjacent\n- A new orbit, if it stays standalone\n\nSee the on-call rotation for follow-up.",
  });
  addNote("node", ungroupedNode, {
    title: "History",
    text: "Originally provisioned as a scratch service for a spike test and never decommissioned. Traffic is low but non-zero, so removal needs a deprecation notice first.\n\n```\nlast traffic check: 2026-06-02, ~40 req/day\n```",
  });

  const spaceBeta = addSpace({
    projectId,
    name: "Space Beta",
    origin: { x: 14, y: 0, z: 0 },
    tags: ["external-facing"],
    metadata: { region: "eu-west-1" },
  });
  const remoteNode = addNode({ spaceId: spaceBeta, name: "Remote Node", tags: ["billing"] });

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
    text: "Routed over the site-to-site VPN subnet `10.0.4.0/24`, VLAN `12`.\n\n- **Source** — Ungrouped Node (Space Alpha)\n- **Target** — Remote Node (Space Beta)\n\nLatency is typically 8–12ms; alert fires above 50ms.",
  });
  addNote("relationship", crossSpaceRel, {
    title: "Change history",
    text: "1. **2026-02-14** — VPN tunnel established, VLAN 12 assigned\n2. **2026-04-03** — Cardinality widened from `1:N` to `N:M` to support multi-tenant lookups\n\n> Any further cardinality changes need sign-off from both space owners.",
  });

  return projectId;
}
