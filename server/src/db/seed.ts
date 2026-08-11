import type { Note, ProjectDetail } from "shared";
import { db } from "./connection";
import { projects } from "./schema";
import { upsertProject } from "./writes";

// Same demo content client/src/store/seed.ts used to fabricate in-memory on every load — moved
// here so it's seeded into SQLite exactly once, on first boot, rather than re-fabricated by the
// client. The client now only ever loads from the server.
function note(title: string, text: string, extra?: Partial<Note>): Note {
  return { id: crypto.randomUUID(), title, text, createdAt: Date.now(), ...extra };
}

function buildDemoProject(): ProjectDetail {
  const projectId = crypto.randomUUID();
  const spaceAlphaId = crypto.randomUUID();
  const spaceBetaId = crypto.randomUUID();
  const orbitAId = crypto.randomUUID();
  const emptyOrbitId = crypto.randomUUID();
  const node1Id = crypto.randomUUID();
  const node2Id = crypto.randomUUID();
  const ungroupedNodeId = crypto.randomUUID();
  const remoteNodeId = crypto.randomUUID();
  const crossSpaceRelId = crypto.randomUUID();

  const tagProd = { id: crypto.randomUUID(), projectId, name: "prod" };
  const tagCore = { id: crypto.randomUUID(), projectId, name: "core" };
  const tagBilling = { id: crypto.randomUUID(), projectId, name: "billing" };
  const tagInternal = { id: crypto.randomUUID(), projectId, name: "internal" };
  const tagExternalFacing = { id: crypto.randomUUID(), projectId, name: "external-facing" };
  const tagVpn = { id: crypto.randomUUID(), projectId, name: "vpn" };

  return {
    project: { id: projectId, name: "Demo Project" },
    tags: [tagProd, tagCore, tagBilling, tagInternal, tagExternalFacing, tagVpn],
    spaces: [
      {
        id: spaceAlphaId,
        projectId,
        name: "Space Alpha",
        origin: { x: 0, y: 0, z: 0 },
        tagIds: [tagProd.id],
        metadata: { region: "us-east-1" },
        notes: [
          note(
            "Overview",
            "## Space Alpha\n\nProduction space for the billing and identity stack. Hosts two orbits:\n\n- **Orbit A** — core services, actively maintained\n- **Empty Orbit** — reserved for the upcoming payments split\n\nRegion is `us-east-1`. See the [runbook](https://example.com/runbooks/space-alpha) before making changes.",
            { author: "Alex" },
          ),
          note(
            "Maintenance window",
            "Standard maintenance window is **Sundays 02:00–04:00 UTC**.\n\n1. Announce in `#platform-changes` 24h ahead\n2. Drain traffic from the affected orbit\n3. Apply changes, then verify health checks\n\n> Skipping step 1 caused a paging incident in March — don't skip step 1.",
            { author: "Alex" },
          ),
        ],
        orbits: [
          {
            id: orbitAId,
            spaceId: spaceAlphaId,
            name: "Orbit A",
            origin: { x: 3.5, y: 0, z: 0 },
            tagIds: [tagCore.id],
            metadata: { owner: "platform-team" },
            notes: [
              note(
                "Overview",
                "### Orbit A\n\nOwned by the `platform-team`. Groups the core billing nodes:\n\n- Node 1 — primary billing service\n- Node 2 — internal support service\n\n---\n\nChanges here require a review from platform-team before merge.",
              ),
              note(
                "On-call",
                "Current rotation:\n\n1. **Primary** — Jordan\n2. **Secondary** — Priya\n3. **Escalation** — Alex\n\nPage via `pagerduty:orbit-a`. For non-urgent issues, open a ticket instead — see the [on-call guide](https://example.com/runbooks/on-call).",
              ),
            ],
            nodes: [
              {
                id: node1Id,
                spaceId: spaceAlphaId,
                orbitId: orbitAId,
                name: "Node 1",
                position: { x: 1, y: 0.5, z: 0 },
                tagIds: [tagBilling.id],
                metadata: { version: "2.3.1" },
                notes: [
                  note(
                    "Purpose",
                    "Handles billing invoice generation and dunning. Reads from `orders` and writes to `invoices`.\n\nDeployed as a single service, version `2.3.1`. Scales horizontally behind the internal load balancer — see the [architecture doc](https://example.com/docs/node-1-architecture) for the full request path.",
                  ),
                  note(
                    "Known issues",
                    "- Retry storm under `>500 req/s` on the `/invoices` endpoint — tracked, fix targeted for next release\n- Occasional clock drift causes duplicate dunning emails\n\n> Workaround: restart the service if duplicate emails are reported; root cause is still open.",
                  ),
                ],
              },
              {
                id: node2Id,
                spaceId: spaceAlphaId,
                orbitId: orbitAId,
                name: "Node 2",
                position: { x: -1, y: -0.5, z: 0.5 },
                tagIds: [tagInternal.id],
                notes: [],
              },
            ],
          },
          {
            id: emptyOrbitId,
            spaceId: spaceAlphaId,
            name: "Empty Orbit",
            origin: { x: -3.5, y: 0, z: 0 },
            tagIds: [],
            notes: [],
            nodes: [],
          },
        ],
        ungroupedNodes: [
          {
            id: ungroupedNodeId,
            spaceId: spaceAlphaId,
            name: "Ungrouped Node",
            position: { x: 0, y: 3, z: -1.5 },
            tagIds: [],
            notes: [
              note(
                "Pending triage",
                "**Not yet assigned to an orbit** — pending review.\n\nCandidate homes:\n\n- Orbit A, if it turns out to be billing-adjacent\n- A new orbit, if it stays standalone\n\nSee the on-call rotation for follow-up.",
              ),
              note(
                "History",
                "Originally provisioned as a scratch service for a spike test and never decommissioned. Traffic is low but non-zero, so removal needs a deprecation notice first.\n\n```\nlast traffic check: 2026-06-02, ~40 req/day\n```",
              ),
            ],
          },
        ],
      },
      {
        id: spaceBetaId,
        projectId,
        name: "Space Beta",
        origin: { x: 14, y: 0, z: 0 },
        tagIds: [tagExternalFacing.id],
        metadata: { region: "eu-west-1" },
        notes: [],
        orbits: [],
        ungroupedNodes: [
          {
            id: remoteNodeId,
            spaceId: spaceBetaId,
            name: "Remote Node",
            position: { x: 0, y: 0, z: 0 },
            tagIds: [tagBilling.id],
            notes: [],
          },
        ],
      },
    ],
    relationships: [
      {
        id: crypto.randomUUID(),
        sourceId: node1Id,
        targetId: node2Id,
        cardinality: "1:N",
        tagIds: [],
        notes: [],
      },
      {
        id: crypto.randomUUID(),
        sourceId: node1Id,
        targetId: ungroupedNodeId,
        cardinality: "1:1",
        tagIds: [],
        notes: [],
      },
      {
        id: crossSpaceRelId,
        sourceId: ungroupedNodeId,
        targetId: remoteNodeId,
        cardinality: "N:M",
        tagIds: [tagVpn.id],
        metadata: { cidr: "10.0.4.0/24", vlan: 12 },
        notes: [
          note(
            "Network path",
            "Routed over the site-to-site VPN subnet `10.0.4.0/24`, VLAN `12`.\n\n- **Source** — Ungrouped Node (Space Alpha)\n- **Target** — Remote Node (Space Beta)\n\nLatency is typically 8–12ms; alert fires above 50ms.",
          ),
          note(
            "Change history",
            "1. **2026-02-14** — VPN tunnel established, VLAN 12 assigned\n2. **2026-04-03** — Cardinality widened from `1:N` to `N:M` to support multi-tenant lookups\n\n> Any further cardinality changes need sign-off from both space owners.",
          ),
        ],
      },
    ],
  };
}

export function seedIfEmpty(): void {
  const [existing] = db.select({ id: projects.id }).from(projects).limit(1).all();
  if (existing) return;

  const demo = buildDemoProject();
  upsertProject(demo.project.id, demo);
}
