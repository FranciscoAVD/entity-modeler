import { eq, inArray } from "drizzle-orm";
import type { ProjectDetail } from "shared";
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

// Full-project replace: the client is the sole source of truth for validation/cascade logic
// (store.ts), so the server never needs to diff or partially patch — it just clears out whatever
// it previously had for this project id and re-inserts the complete, already-valid snapshot the
// client sends. `id` doubles as create-or-replace: if no project with this id exists yet, the
// delete step is a no-op and this becomes a plain insert.
export function upsertProject(id: string, data: ProjectDetail): void {
  db.transaction((tx) => {
    // notes have no FK to their target (polymorphic target_type/target_id), so cascading a
    // project delete won't clean them up — gather the *old* target ids first so they can be
    // deleted explicitly, before the cascade below removes the rows those ids pointed at.
    const oldSpaceIds = tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.projectId, id)).all().map((r) => r.id);
    const oldOrbitIds = oldSpaceIds.length
      ? tx.select({ id: orbits.id }).from(orbits).where(inArray(orbits.spaceId, oldSpaceIds)).all().map((r) => r.id)
      : [];
    const oldNodeIds = oldSpaceIds.length
      ? tx.select({ id: nodes.id }).from(nodes).where(inArray(nodes.spaceId, oldSpaceIds)).all().map((r) => r.id)
      : [];
    const oldRelationshipIds = oldNodeIds.length
      ? tx
          .select({ id: relationships.id })
          .from(relationships)
          .where(inArray(relationships.sourceId, oldNodeIds))
          .all()
          .map((r) => r.id)
      : [];
    const oldTargetIds = [...oldSpaceIds, ...oldOrbitIds, ...oldNodeIds, ...oldRelationshipIds];
    if (oldTargetIds.length) tx.delete(notes).where(inArray(notes.targetId, oldTargetIds)).run();

    // Cascades away spaces -> orbits/nodes -> relationships/join-tables, and tags -> join-tables,
    // per the FK onDelete rules in schema.ts. No-op if this is a brand-new project id.
    tx.delete(projects).where(eq(projects.id, id)).run();

    tx.insert(projects).values({ id, name: data.project.name, description: data.project.description }).run();

    if (data.tags.length) {
      tx.insert(tags)
        .values(data.tags.map((t) => ({ id: t.id, projectId: t.projectId, name: t.name })))
        .run();
    }

    const flatOrbits = data.spaces.flatMap((s) => s.orbits);
    const flatNodes = data.spaces.flatMap((s) => [
      ...s.ungroupedNodes,
      ...s.orbits.flatMap((o) => o.nodes),
    ]);

    if (data.spaces.length) {
      tx.insert(spaces)
        .values(
          data.spaces.map((s) => ({
            id: s.id,
            projectId: s.projectId,
            name: s.name,
            label: s.label,
            originX: s.origin.x,
            originY: s.origin.y,
            originZ: s.origin.z,
            metadata: s.metadata,
          })),
        )
        .run();
    }

    if (flatOrbits.length) {
      tx.insert(orbits)
        .values(
          flatOrbits.map((o) => ({
            id: o.id,
            spaceId: o.spaceId,
            name: o.name,
            label: o.label,
            originX: o.origin.x,
            originY: o.origin.y,
            originZ: o.origin.z,
            metadata: o.metadata,
          })),
        )
        .run();
    }

    if (flatNodes.length) {
      tx.insert(nodes)
        .values(
          flatNodes.map((n) => ({
            id: n.id,
            spaceId: n.spaceId,
            orbitId: n.orbitId,
            name: n.name,
            positionX: n.position.x,
            positionY: n.position.y,
            positionZ: n.position.z,
            metadata: n.metadata,
          })),
        )
        .run();
    }

    if (data.relationships.length) {
      tx.insert(relationships)
        .values(
          data.relationships.map((r) => ({
            id: r.id,
            sourceId: r.sourceId,
            targetId: r.targetId,
            cardinality: r.cardinality,
            metadata: r.metadata,
          })),
        )
        .run();
    }

    const allNotes = [
      ...data.spaces.flatMap((s) => s.notes.map((n) => ({ note: n, targetType: "space" as const, targetId: s.id }))),
      ...flatOrbits.flatMap((o) => o.notes.map((n) => ({ note: n, targetType: "orbit" as const, targetId: o.id }))),
      ...flatNodes.flatMap((n) => n.notes.map((note) => ({ note, targetType: "node" as const, targetId: n.id }))),
      ...data.relationships.flatMap((r) =>
        r.notes.map((n) => ({ note: n, targetType: "relationship" as const, targetId: r.id })),
      ),
    ];
    if (allNotes.length) {
      tx.insert(notes)
        .values(
          allNotes.map(({ note, targetType, targetId }) => ({
            id: note.id,
            targetType,
            targetId,
            title: note.title,
            text: note.text,
            author: note.author,
            createdAt: note.createdAt,
            metadata: note.metadata,
          })),
        )
        .run();
    }

    const spaceTagRows = data.spaces.flatMap((s) => s.tagIds.map((tagId) => ({ spaceId: s.id, tagId })));
    if (spaceTagRows.length) tx.insert(spaceTags).values(spaceTagRows).run();

    const orbitTagRows = flatOrbits.flatMap((o) => o.tagIds.map((tagId) => ({ orbitId: o.id, tagId })));
    if (orbitTagRows.length) tx.insert(orbitTags).values(orbitTagRows).run();

    const nodeTagRows = flatNodes.flatMap((n) => n.tagIds.map((tagId) => ({ nodeId: n.id, tagId })));
    if (nodeTagRows.length) tx.insert(nodeTags).values(nodeTagRows).run();

    const relationshipTagRows = data.relationships.flatMap((r) =>
      r.tagIds.map((tagId) => ({ relationshipId: r.id, tagId })),
    );
    if (relationshipTagRows.length) tx.insert(relationshipTags).values(relationshipTagRows).run();
  });
}

export function deleteProject(id: string): boolean {
  const [existing] = db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).all();
  if (!existing) return false;
  db.delete(projects).where(eq(projects.id, id)).run();
  return true;
}
