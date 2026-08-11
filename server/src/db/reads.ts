import { asc, eq, inArray, or } from "drizzle-orm";
import type { Note, OrbitDetail, ProjectDetail, ProjectSummary, SpaceDetail, Tag } from "shared";
import { ProjectDetailSchema } from "shared";
import { db } from "./connection";
import {
  nodes,
  nodeTags,
  notes,
  orbits,
  orbitTags,
  projects,
  relationships,
  relationshipTags,
  spaces,
  spaceTags,
  tags,
} from "./schema";

// Ordered explicitly (SQLite gives no ordering guarantee without one) — without this, App.tsx's
// "load list[0] on boot" would be at the mercy of table scan order, which silently changes
// whenever a project is saved: upsertProject deletes and reinserts the `projects` row itself (to
// let the FK cascade clear its children), giving that row a new rowid and moving it to the end of
// an unordered scan — so the project that loads by default could flip after any edit to any
// project, reading as "different seeded data on reload."
export async function loadProjectList(): Promise<ProjectSummary[]> {
  const rows = await db.select().from(projects).orderBy(asc(projects.name));
  return rows.map((p) => ({ id: p.id, name: p.name, description: p.description ?? undefined }));
}

// Reassembles the nested tree (project -> spaces -> (orbits -> nodes) + ungroupedNodes, with
// relationships/tags as flat siblings) from flat table rows scoped to one project — the inverse
// of writes.ts's upsertProject. Validated through ProjectDetailSchema before returning, so a
// reshape bug here fails loudly instead of shipping a malformed response.
export async function loadProjectDetail(projectId: string): Promise<ProjectDetail | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return undefined;

  const spaceRows = await db.select().from(spaces).where(eq(spaces.projectId, projectId));
  const spaceIds = spaceRows.map((s) => s.id);

  const orbitRows = spaceIds.length
    ? await db.select().from(orbits).where(inArray(orbits.spaceId, spaceIds))
    : [];
  const orbitIds = orbitRows.map((o) => o.id);

  const nodeRows = spaceIds.length
    ? await db.select().from(nodes).where(inArray(nodes.spaceId, spaceIds))
    : [];
  const nodeIds = nodeRows.map((n) => n.id);

  const relationshipRows = nodeIds.length
    ? await db
        .select()
        .from(relationships)
        .where(or(inArray(relationships.sourceId, nodeIds), inArray(relationships.targetId, nodeIds)))
    : [];
  const relationshipIds = relationshipRows.map((r) => r.id);

  const tagRows = await db.select().from(tags).where(eq(tags.projectId, projectId));

  const noteConditions = [
    spaceIds.length ? inArray(notes.spaceId, spaceIds) : undefined,
    orbitIds.length ? inArray(notes.orbitId, orbitIds) : undefined,
    nodeIds.length ? inArray(notes.nodeId, nodeIds) : undefined,
    relationshipIds.length ? inArray(notes.relationshipId, relationshipIds) : undefined,
  ].filter((c) => c !== undefined);
  const noteRows = noteConditions.length ? await db.select().from(notes).where(or(...noteConditions)) : [];

  const [spaceTagRows, orbitTagRows, nodeTagRows, relationshipTagRows] = await Promise.all([
    spaceIds.length
      ? db.select().from(spaceTags).where(inArray(spaceTags.spaceId, spaceIds))
      : Promise.resolve([]),
    orbitIds.length
      ? db.select().from(orbitTags).where(inArray(orbitTags.orbitId, orbitIds))
      : Promise.resolve([]),
    nodeIds.length
      ? db.select().from(nodeTags).where(inArray(nodeTags.nodeId, nodeIds))
      : Promise.resolve([]),
    relationshipIds.length
      ? db.select().from(relationshipTags).where(inArray(relationshipTags.relationshipId, relationshipIds))
      : Promise.resolve([]),
  ]);

  const groupBy = <T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> => {
    const map = new Map<K, T[]>();
    for (const row of rows) {
      const k = key(row);
      const list = map.get(k);
      if (list) list.push(row);
      else map.set(k, [row]);
    }
    return map;
  };

  const notesBySpace = groupBy(
    noteRows.filter((n) => n.spaceId !== null),
    (n) => n.spaceId as string,
  );
  const notesByOrbit = groupBy(
    noteRows.filter((n) => n.orbitId !== null),
    (n) => n.orbitId as string,
  );
  const notesByNode = groupBy(
    noteRows.filter((n) => n.nodeId !== null),
    (n) => n.nodeId as string,
  );
  const notesByRelationship = groupBy(
    noteRows.filter((n) => n.relationshipId !== null),
    (n) => n.relationshipId as string,
  );
  const toNote = (row: (typeof noteRows)[number]): Note => ({
    id: row.id,
    title: row.title,
    text: row.text,
    author: row.author ?? undefined,
    createdAt: row.createdAt,
  });

  const spaceTagsByTarget = groupBy(spaceTagRows, (r) => r.spaceId);
  const orbitTagsByTarget = groupBy(orbitTagRows, (r) => r.orbitId);
  const nodeTagsByTarget = groupBy(nodeTagRows, (r) => r.nodeId);
  const relationshipTagsByTarget = groupBy(relationshipTagRows, (r) => r.relationshipId);

  const nodesByOrbit = groupBy(
    nodeRows.filter((n) => n.orbitId !== null),
    (n) => n.orbitId as string,
  );
  const ungroupedNodesBySpace = groupBy(
    nodeRows.filter((n) => n.orbitId === null),
    (n) => n.spaceId,
  );
  const orbitsBySpace = groupBy(orbitRows, (o) => o.spaceId);

  const toNodeDetail = (row: (typeof nodeRows)[number]) => ({
    id: row.id,
    spaceId: row.spaceId,
    orbitId: row.orbitId ?? undefined,
    name: row.name,
    tagIds: (nodeTagsByTarget.get(row.id) ?? []).map((t) => t.tagId),
    position: { x: row.positionX, y: row.positionY, z: row.positionZ },
    notes: (notesByNode.get(row.id) ?? []).map(toNote),
    metadata: row.metadata ?? undefined,
  });

  const toOrbitDetail = (row: (typeof orbitRows)[number]): OrbitDetail => ({
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    label: row.label ?? undefined,
    origin: { x: row.originX, y: row.originY, z: row.originZ },
    tagIds: (orbitTagsByTarget.get(row.id) ?? []).map((t) => t.tagId),
    notes: (notesByOrbit.get(row.id) ?? []).map(toNote),
    metadata: row.metadata ?? undefined,
    nodes: (nodesByOrbit.get(row.id) ?? []).map(toNodeDetail),
  });

  const toSpaceDetail = (row: (typeof spaceRows)[number]): SpaceDetail => ({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    label: row.label ?? undefined,
    origin: { x: row.originX, y: row.originY, z: row.originZ },
    tagIds: (spaceTagsByTarget.get(row.id) ?? []).map((t) => t.tagId),
    notes: (notesBySpace.get(row.id) ?? []).map(toNote),
    metadata: row.metadata ?? undefined,
    orbits: (orbitsBySpace.get(row.id) ?? []).map(toOrbitDetail),
    ungroupedNodes: (ungroupedNodesBySpace.get(row.id) ?? []).map(toNodeDetail),
  });

  const toTag = (row: (typeof tagRows)[number]): Tag => ({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
  });

  return ProjectDetailSchema.parse({
    project: { id: project.id, name: project.name, description: project.description ?? undefined },
    spaces: spaceRows.map(toSpaceDetail),
    relationships: relationshipRows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      targetId: r.targetId,
      cardinality: r.cardinality,
      tagIds: (relationshipTagsByTarget.get(r.id) ?? []).map((t) => t.tagId),
      notes: (notesByRelationship.get(r.id) ?? []).map(toNote),
      metadata: r.metadata ?? undefined,
    })),
    tags: tagRows.map(toTag),
  });
}
