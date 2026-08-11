import { eq } from "drizzle-orm";
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
    // Cascades away spaces -> orbits/nodes/notes -> relationships/notes/join-tables, and
    // tags -> join-tables, per the FK onDelete rules in schema.ts — notes now have a real FK to
    // their parent, so no manual pre-delete step is needed (unlike the old polymorphic table).
    // No-op if this is a brand-new project id.
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

    // Exactly one of spaceId/orbitId/nodeId/relationshipId is set per row — which one depends on
    // which of the four flatMaps below a given note came from.
    const allNotes = [
      ...data.spaces.flatMap((s) => s.notes.map((note) => ({ note, spaceId: s.id }))),
      ...flatOrbits.flatMap((o) => o.notes.map((note) => ({ note, orbitId: o.id }))),
      ...flatNodes.flatMap((n) => n.notes.map((note) => ({ note, nodeId: n.id }))),
      ...data.relationships.flatMap((r) => r.notes.map((note) => ({ note, relationshipId: r.id }))),
    ];
    if (allNotes.length) {
      tx.insert(notes)
        .values(
          allNotes.map(({ note, ...parent }) => ({
            id: note.id,
            title: note.title,
            text: note.text,
            author: note.author,
            createdAt: note.createdAt,
            ...parent,
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
