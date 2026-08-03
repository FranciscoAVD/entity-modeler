import { Badge } from "@/components/ui/badge";
import { useModelStore } from "@/store/store";
import type { Field, Note } from "@/store/types";

// Shared across every level (entity fields, orbit tags, note metadata) per plan.md decision #6:
// "Same shape, same rendering path at every level."
export function MetadataTable({ metadata }: { metadata: Record<string, string | number> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;

  return (
    <table className="text-xs">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td className="text-muted-foreground py-0.5 pr-3 font-mono">{key}</td>
            <td className="py-0.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Notes</h4>
      {notes.map((note) => (
        <div key={note.id} className="border-border rounded-md border p-2 text-sm">
          <p className="whitespace-pre-wrap">{note.text}</p>
          {note.author && <p className="text-muted-foreground mt-1 text-xs">— {note.author}</p>}
          {note.metadata && (
            <div className="mt-1.5">
              <MetadataTable metadata={note.metadata} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FieldsTable({ fields }: { fields: Field[] }) {
  if (fields.length === 0) return null;

  return (
    <table className="w-full text-sm">
      <tbody>
        {fields.map((field) => (
          <tr key={field.id}>
            <td className="py-0.5 pr-2 font-mono">{field.name}</td>
            <td className="text-muted-foreground py-0.5">{field.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EntityDetails({ entityId }: { entityId: string }) {
  const entity = useModelStore((state) => state.entities.get(entityId));
  if (!entity) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{entity.name}</h3>
      <FieldsTable fields={entity.fields} />
      <NoteList notes={entity.notes} />
    </div>
  );
}

// Space and Orbit share the same displayable shape (label/name, tags, metadata, notes), so
// orbit and space tabs both render through this rather than duplicating the same JSX per type.
function GroupDetails({
  name,
  label,
  tags,
  metadata,
  notes,
}: {
  name: string;
  label?: string;
  tags: string[];
  metadata?: Record<string, string | number>;
  notes: Note[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{label ?? name}</h3>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {metadata && <MetadataTable metadata={metadata} />}
      <NoteList notes={notes} />
    </div>
  );
}

function OrbitDetails({ orbitId }: { orbitId: string }) {
  const orbit = useModelStore((state) => state.orbits.get(orbitId));
  if (!orbit) return null;

  return <GroupDetails {...orbit} />;
}

function SpaceDetails({ spaceId }: { spaceId: string }) {
  const space = useModelStore((state) => state.spaces.get(spaceId));
  if (!space) return null;

  return <GroupDetails {...space} />;
}

function RelationshipDetails({ relationshipId }: { relationshipId: string }) {
  const relationship = useModelStore((state) => state.relationships.get(relationshipId));
  const sourceName = useModelStore((state) =>
    relationship ? state.entities.get(relationship.sourceId)?.name : undefined,
  );
  const targetName = useModelStore((state) =>
    relationship ? state.entities.get(relationship.targetId)?.name : undefined,
  );
  if (!relationship) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">
        {sourceName ?? "?"} → {targetName ?? "?"}
      </h3>
      <p className="text-muted-foreground text-sm">Cardinality: {relationship.cardinality}</p>
      <NoteList notes={relationship.notes} />
    </div>
  );
}

export function InfoPanel() {
  const activeTabId = useModelStore((state) => state.activeTabId);
  const activeTab = useModelStore((state) => state.openTabs.find((t) => t.id === activeTabId));

  if (!activeTab) return null;

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {activeTab.type === "entity" && <EntityDetails entityId={activeTab.id} />}
      {activeTab.type === "orbit" && <OrbitDetails orbitId={activeTab.id} />}
      {activeTab.type === "space" && <SpaceDetails spaceId={activeTab.id} />}
      {activeTab.type === "relationship" && <RelationshipDetails relationshipId={activeTab.id} />}
    </div>
  );
}
