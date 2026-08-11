import { ArrowRight, ArrowRightLeft, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  nodesInProject,
  projectIdForNode,
  projectIdForOrbit,
  relationshipScope,
  tagNamesForIds,
  tagsInProject,
} from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Cardinality, Note, NoteTargetType } from "@/store/types";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MarkdownContent } from "./MarkdownContent";
import { MetadataEditor } from "./MetadataEditor";
import { MetadataTable } from "./MetadataTable";
import { EDGE_STYLES } from "./RelationshipEdge";
import { TagEditor } from "./TagEditor";
import { useViewStore } from "./viewStore";

// InfoPanel itself carries no padding — it's flush edge-to-edge so the Notes section's note rows
// can hover full-width. Everything else opts into the panel's horizontal inset via this wrapper.
function PanelSection({ children }: { children: ReactNode }) {
  return <div className="space-y-3 px-3">{children}</div>;
}

// NotePanel (docked, see Overlay.tsx) owns view/add/edit; "which note is open" lives in
// viewStore's openNote/openNoteFor rather than local state here, since NotePanel has to be
// reachable from outside this subtree.
export function NoteList({
  targetType,
  targetId,
  notes,
}: {
  targetType: NoteTargetType;
  targetId: string;
  notes: Note[];
}) {
  const deleteNote = useModelStore((state) => state.deleteNote);
  const openNote = useViewStore((state) => state.openNote);
  const openNoteFor = useViewStore((state) => state.openNoteFor);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3">
        <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">Notes</h4>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openNoteFor(targetType, targetId, "new")}
          aria-label="Add note"
        >
          <Plus />
        </Button>
      </div>
      {notes.map((note) => (
        <div
          key={note.id}
          className={cn(
            "hover:bg-accent/10 cursor-pointer py-2 transition-colors",
            openNote &&
              openNote.note !== "new" &&
              openNote.targetType === targetType &&
              openNote.targetId === targetId &&
              openNote.note.id === note.id &&
              "bg-accent/10",
          )}
          onClick={() => openNoteFor(targetType, targetId, note)}
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
            <MarkdownContent text={note.text} className="line-clamp-6 mt-1 text-sm" />
            {note.author && <p className="text-muted-foreground mt-1 text-sm">— {note.author}</p>}
          </div>
        </div>
      ))}
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

// Space, Orbit, and Node all share the same displayable shape (name, optional label, tags,
// metadata, notes) — Node has no label of its own, so it just falls back to name — so all
// three tabs render through this rather than duplicating the same JSX per type. Tag/metadata
// edits are delegated back to the caller via onUpdateTags/onUpdateMetadata, since each type has
// its own store action (updateNodeTags vs. updateOrbitTags, etc.) — this component stays
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
  existingTags,
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
  existingTags: string[];
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
          <TagEditor tags={tags} existingTags={existingTags} onUpdate={onUpdateTags} />
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

function NodeDetails({ nodeId }: { nodeId: string }) {
  const node = useModelStore((state) => state.nodes.get(nodeId));
  const tagNames = useModelStore(
    useShallow((state) => (node ? tagNamesForIds(state, node.tagIds) : [])),
  );
  const existingTags = useModelStore(
    useShallow((state) => {
      const projectId = projectIdForNode(state, nodeId);
      return projectId ? tagsInProject(state, projectId).map((t) => t.name) : [];
    }),
  );
  const updateNodeTags = useModelStore((state) => state.updateNodeTags);
  const updateNodeMetadata = useModelStore((state) => state.updateNodeMetadata);
  if (!node) return null;

  return (
    <GroupDetails
      key={node.id}
      {...node}
      tags={tagNames}
      existingTags={existingTags}
      onUpdateTags={(tags) => updateNodeTags(node.id, tags)}
      onUpdateMetadata={(metadata) => updateNodeMetadata(node.id, metadata)}
      noteTargetType="node"
      titleClassName="text-node"
    />
  );
}

function OrbitDetails({ orbitId }: { orbitId: string }) {
  const orbit = useModelStore((state) => state.orbits.get(orbitId));
  const tagNames = useModelStore(
    useShallow((state) => (orbit ? tagNamesForIds(state, orbit.tagIds) : [])),
  );
  const existingTags = useModelStore(
    useShallow((state) => {
      const projectId = projectIdForOrbit(state, orbitId);
      return projectId ? tagsInProject(state, projectId).map((t) => t.name) : [];
    }),
  );
  const updateOrbitTags = useModelStore((state) => state.updateOrbitTags);
  const updateOrbitMetadata = useModelStore((state) => state.updateOrbitMetadata);
  if (!orbit) return null;

  return (
    <GroupDetails
      key={orbit.id}
      {...orbit}
      tags={tagNames}
      existingTags={existingTags}
      onUpdateTags={(tags) => updateOrbitTags(orbit.id, tags)}
      onUpdateMetadata={(metadata) => updateOrbitMetadata(orbit.id, metadata)}
      noteTargetType="orbit"
      titleClassName="text-orbit"
    />
  );
}

function SpaceDetails({ spaceId }: { spaceId: string }) {
  const space = useModelStore((state) => state.spaces.get(spaceId));
  const tagNames = useModelStore(
    useShallow((state) => (space ? tagNamesForIds(state, space.tagIds) : [])),
  );
  const existingTags = useModelStore(
    useShallow((state) => (space ? tagsInProject(state, space.projectId).map((t) => t.name) : [])),
  );
  const updateSpaceTags = useModelStore((state) => state.updateSpaceTags);
  const updateSpaceMetadata = useModelStore((state) => state.updateSpaceMetadata);
  if (!space) return null;

  return (
    <GroupDetails
      key={space.id}
      {...space}
      tags={tagNames}
      existingTags={existingTags}
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
    relationship ? state.nodes.get(relationship.sourceId)?.name : undefined,
  );
  const targetName = useModelStore((state) =>
    relationship ? state.nodes.get(relationship.targetId)?.name : undefined,
  );
  const scope = useModelStore((state) => relationshipScope(state, relationshipId));
  const projectId = useModelStore((state) =>
    relationship ? projectIdForNode(state, relationship.sourceId) : undefined,
  );
  const projectNodes = useModelStore(
    useShallow((state) => (projectId ? nodesInProject(state, projectId) : [])),
  );
  const tagNames = useModelStore(
    useShallow((state) => (relationship ? tagNamesForIds(state, relationship.tagIds) : [])),
  );
  const existingTags = useModelStore(
    useShallow((state) => (projectId ? tagsInProject(state, projectId).map((t) => t.name) : [])),
  );
  const deleteRelationship = useModelStore((state) => state.deleteRelationship);
  const updateRelationshipCardinality = useModelStore(
    (state) => state.updateRelationshipCardinality,
  );
  const updateRelationshipEndpoints = useModelStore((state) => state.updateRelationshipEndpoints);
  const updateRelationshipTags = useModelStore((state) => state.updateRelationshipTags);
  const updateRelationshipMetadata = useModelStore((state) => state.updateRelationshipMetadata);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!relationship) return null;

  // N:M is many-to-many both ways, so it borrows the same bidirectional icon as the sidebar's
  // "Add relationship" action; 1:1/1:N stay a single directional arrow, source to target.
  const CardinalityIcon = relationship.cardinality === "N:M" ? ArrowRightLeft : ArrowRight;

  // Picking a node already on the other end swaps the two rather than leaving an invalid
  // (or silently rejected) same-node pair — mirrors AddRelationshipDialog's source-change guard.
  const handleSourceChange = (sourceId: string) => {
    const targetId = sourceId === relationship.targetId ? relationship.sourceId : relationship.targetId;
    updateRelationshipEndpoints(relationshipId, { sourceId, targetId });
  };
  const handleTargetChange = (targetId: string) => {
    const sourceId = targetId === relationship.sourceId ? relationship.targetId : relationship.sourceId;
    updateRelationshipEndpoints(relationshipId, { sourceId, targetId });
  };

  return (
    <div className="space-y-3">
      <PanelSection>
        <div className="flex items-center justify-between gap-2">
          <h3
            className="flex min-w-0 items-center gap-2 text-xl font-semibold"
            style={{ color: EDGE_STYLES[scope].color }}
          >
            <span className="min-w-0 truncate">{sourceName ?? "?"}</span>
            <CardinalityIcon className="size-5 shrink-0" />
            <span className="min-w-0 truncate">{targetName ?? "?"}</span>
          </h3>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? "Done editing relationship" : "Edit relationship"}
          >
            {editing ? <Check /> : <Pencil />}
          </Button>
        </div>
        {editing ? (
          <div className="space-y-1.5">
            <Select value={relationship.sourceId} onValueChange={handleSourceChange}>
              <SelectTrigger className="h-7 w-full text-sm">
                <SelectValue placeholder="Source node" />
              </SelectTrigger>
              <SelectContent>
                {projectNodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={relationship.targetId} onValueChange={handleTargetChange}>
              <SelectTrigger className="h-7 w-full text-sm">
                <SelectValue placeholder="Target node" />
              </SelectTrigger>
              <SelectContent>
                {projectNodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={relationship.cardinality}
              onValueChange={(value) =>
                updateRelationshipCardinality(relationshipId, value as Cardinality)
              }
            >
              <SelectTrigger className="h-7 w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="1:N">1:N</SelectItem>
                <SelectItem value="N:M">N:M</SelectItem>
              </SelectContent>
            </Select>
            <TagEditor
              tags={tagNames}
              existingTags={existingTags}
              onUpdate={(tags) => updateRelationshipTags(relationshipId, tags)}
            />
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">Cardinality: {relationship.cardinality}</p>
            {tagNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagNames.map((tag) => (
                  <Badge key={tag} variant="secondary" className="capitalize">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {relationship.metadata && <MetadataTable metadata={relationship.metadata} />}
          </>
        )}
      </PanelSection>
      {editing && (
        <MetadataEditor
          metadata={relationship.metadata}
          onUpdate={(metadata) => updateRelationshipMetadata(relationshipId, metadata)}
        />
      )}
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
      {activeTab.type === "node" && <NodeDetails nodeId={activeTab.id} />}
      {activeTab.type === "orbit" && <OrbitDetails orbitId={activeTab.id} />}
      {activeTab.type === "space" && <SpaceDetails spaceId={activeTab.id} />}
      {activeTab.type === "relationship" && <RelationshipDetails relationshipId={activeTab.id} />}
    </div>
  );
}
