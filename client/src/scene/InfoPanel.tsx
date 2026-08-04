import { ArrowRight, ArrowRightLeft, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relationshipScope } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Note, NoteTargetType } from "@/store/types";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MetadataEditor } from "./MetadataEditor";
import { MetadataTable } from "./MetadataTable";
import { NoteDialog } from "./NoteDialog";
import { EDGE_STYLES } from "./RelationshipEdge";
import { TagEditor } from "./TagEditor";

// InfoPanel itself carries no padding — it's flush edge-to-edge so the Notes section's note rows
// can hover full-width. Everything else opts into the panel's horizontal inset via this wrapper.
function PanelSection({ children }: { children: ReactNode }) {
  return <div className="space-y-3 px-3">{children}</div>;
}

// dialogState is either "new" (Add note), a Note being viewed/edited, or null (dialog closed) —
// one piece of state drives the whole view/add/edit flow through the same NoteDialog instance.
export function NoteList({
  targetType,
  targetId,
  notes,
}: {
  targetType: NoteTargetType;
  targetId: string;
  notes: Note[];
}) {
  const addNote = useModelStore((state) => state.addNote);
  const updateNote = useModelStore((state) => state.updateNote);
  const deleteNote = useModelStore((state) => state.deleteNote);
  const [dialogState, setDialogState] = useState<"new" | Note | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const handleSubmit = (title: string, text: string) => {
    if (dialogState === "new") addNote(targetType, targetId, { title, text });
    else if (dialogState) updateNote(targetType, targetId, dialogState.id, { title, text });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3">
        <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">Notes</h4>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setDialogState("new")}
          aria-label="Add note"
        >
          <Plus />
        </Button>
      </div>
      {notes.map((note) => (
        <div
          key={note.id}
          className="hover:bg-accent/10 cursor-pointer py-2 transition-colors"
          onClick={() => setDialogState(note)}
        >
          {/* Padding lives here, not on the row above — the row itself stays edge-to-edge so its
              hover background spans the full panel width, while the content inside still lines
              up with PanelSection's px-3 inset. */}
          <div className="px-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-medium text-primary">{note.title}</p>
              <div className="flex shrink-0 items-center gap-1">
                <p className="text-muted-foreground text-sm">
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteNoteId(note.id);
                  }}
                  aria-label={`Delete note ${note.title}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <p className="line-clamp-6 mt-1 text-justify whitespace-pre-wrap break-words">
              {note.text}
            </p>
            {note.author && <p className="text-muted-foreground mt-1 text-sm">— {note.author}</p>}
            {note.metadata && (
              <div className="mt-1.5">
                <MetadataTable metadata={note.metadata} />
              </div>
            )}
          </div>
        </div>
      ))}
      <NoteDialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        note={dialogState ?? "new"}
        onSubmit={handleSubmit}
      />
      <DeleteConfirmDialog
        open={deleteNoteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteNoteId(null);
        }}
        title="Delete this note?"
        description="This can't be undone."
        onConfirm={() => deleteNoteId && deleteNote(targetType, targetId, deleteNoteId)}
      />
    </div>
  );
}

// Space, Orbit, and Entity all share the same displayable shape (name, optional label, tags,
// metadata, notes) — Entity has no label of its own, so it just falls back to name — so all
// three tabs render through this rather than duplicating the same JSX per type. Tag/metadata
// edits are delegated back to the caller via onUpdateTags/onUpdateMetadata, since each type has
// its own store action (updateEntityTags vs. updateOrbitTags, etc.) — this component stays
// generic across all three.
//
// Tags/metadata editing is off by default — the pencil button next to the name toggles it,
// swapping the read-only tag/metadata view for TagEditor/MetadataEditor. Notes keep their own
// always-visible add/edit/delete buttons (a separate editing surface, per plan.md decision #6),
// unaffected by this toggle.
function GroupDetails({
  id,
  name,
  label,
  tags,
  metadata,
  notes,
  onUpdateTags,
  onUpdateMetadata,
  noteTargetType,
  titleClassName,
}: {
  id: string;
  name: string;
  label?: string;
  tags: string[];
  metadata?: Record<string, string | number>;
  notes: Note[];
  onUpdateTags: (tags: string[]) => void;
  onUpdateMetadata: (metadata: Record<string, string | number> | undefined) => void;
  noteTargetType: NoteTargetType;
  titleClassName?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      <PanelSection>
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("text-xl font-semibold", titleClassName)}>{label ?? name}</h3>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? "Done editing tags and metadata" : "Edit tags and metadata"}
          >
            {editing ? <Check /> : <Pencil />}
          </Button>
        </div>
        {editing ? (
          <TagEditor tags={tags} onUpdate={onUpdateTags} />
        ) : (
          <>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="capitalize">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {metadata && <MetadataTable metadata={metadata} />}
          </>
        )}
      </PanelSection>
      {editing && <MetadataEditor metadata={metadata} onUpdate={onUpdateMetadata} />}
      <NoteList targetType={noteTargetType} targetId={id} notes={notes} />
    </div>
  );
}

function EntityDetails({ entityId }: { entityId: string }) {
  const entity = useModelStore((state) => state.entities.get(entityId));
  const updateEntityTags = useModelStore((state) => state.updateEntityTags);
  const updateEntityMetadata = useModelStore((state) => state.updateEntityMetadata);
  if (!entity) return null;

  return (
    <GroupDetails
      key={entity.id}
      {...entity}
      onUpdateTags={(tags) => updateEntityTags(entity.id, tags)}
      onUpdateMetadata={(metadata) => updateEntityMetadata(entity.id, metadata)}
      noteTargetType="entity"
      titleClassName="text-entity"
    />
  );
}

function OrbitDetails({ orbitId }: { orbitId: string }) {
  const orbit = useModelStore((state) => state.orbits.get(orbitId));
  const updateOrbitTags = useModelStore((state) => state.updateOrbitTags);
  const updateOrbitMetadata = useModelStore((state) => state.updateOrbitMetadata);
  if (!orbit) return null;

  return (
    <GroupDetails
      key={orbit.id}
      {...orbit}
      onUpdateTags={(tags) => updateOrbitTags(orbit.id, tags)}
      onUpdateMetadata={(metadata) => updateOrbitMetadata(orbit.id, metadata)}
      noteTargetType="orbit"
      titleClassName="text-orbit"
    />
  );
}

function SpaceDetails({ spaceId }: { spaceId: string }) {
  const space = useModelStore((state) => state.spaces.get(spaceId));
  const updateSpaceTags = useModelStore((state) => state.updateSpaceTags);
  const updateSpaceMetadata = useModelStore((state) => state.updateSpaceMetadata);
  if (!space) return null;

  return (
    <GroupDetails
      key={space.id}
      {...space}
      onUpdateTags={(tags) => updateSpaceTags(space.id, tags)}
      onUpdateMetadata={(metadata) => updateSpaceMetadata(space.id, metadata)}
      noteTargetType="space"
      titleClassName="text-space"
    />
  );
}

function RelationshipDetails({ relationshipId }: { relationshipId: string }) {
  const relationship = useModelStore((state) => state.relationships.get(relationshipId));
  const sourceName = useModelStore((state) =>
    relationship ? state.entities.get(relationship.sourceId)?.name : undefined,
  );
  const targetName = useModelStore((state) =>
    relationship ? state.entities.get(relationship.targetId)?.name : undefined,
  );
  const scope = useModelStore((state) => relationshipScope(state, relationshipId));
  const deleteRelationship = useModelStore((state) => state.deleteRelationship);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!relationship) return null;

  // N:M is many-to-many both ways, so it borrows the same bidirectional icon as the sidebar's
  // "Add relationship" action; 1:1/1:N stay a single directional arrow, source to target.
  const CardinalityIcon = relationship.cardinality === "N:M" ? ArrowRightLeft : ArrowRight;

  return (
    <div className="space-y-3">
      <PanelSection>
        <h3
          className="flex items-center gap-2 text-xl font-semibold"
          style={{ color: EDGE_STYLES[scope].color }}
        >
          <span className="min-w-0 truncate">{sourceName ?? "?"}</span>
          <CardinalityIcon className="size-5 shrink-0" />
          <span className="min-w-0 truncate">{targetName ?? "?"}</span>
        </h3>
        <p className="text-muted-foreground text-sm">Cardinality: {relationship.cardinality}</p>
      </PanelSection>
      <NoteList targetType="relationship" targetId={relationshipId} notes={relationship.notes} />
      <PanelSection>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 />
          Delete relationship
        </Button>
      </PanelSection>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this relationship?"
        description="This can't be undone."
        onConfirm={() => deleteRelationship(relationshipId)}
      />
    </div>
  );
}

export function InfoPanel() {
  const activeTabId = useModelStore((state) => state.activeTabId);
  const activeTab = useModelStore((state) => state.openTabs.find((t) => t.id === activeTabId));

  if (!activeTab) return null;

  return (
    <div className="flex-1 overflow-y-auto py-3">
      {activeTab.type === "entity" && <EntityDetails entityId={activeTab.id} />}
      {activeTab.type === "orbit" && <OrbitDetails orbitId={activeTab.id} />}
      {activeTab.type === "space" && <SpaceDetails spaceId={activeTab.id} />}
      {activeTab.type === "relationship" && <RelationshipDetails relationshipId={activeTab.id} />}
    </div>
  );
}
