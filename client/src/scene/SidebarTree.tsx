import { ArrowRight, ArrowRightLeft, ChevronRight, EyeOff, Move, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  nodesInOrbit,
  nodeDeleteImpact,
  orbitsInSpace,
  relationshipsForNode,
  spaceDeleteImpact,
  spacesInProject,
  ungroupedNodesInSpace,
} from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Node, Orbit, Space } from "@/store/types";
import { CreateDialog } from "./CreateDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { PendingCreate } from "./Sidebar";
import { NodeIcon, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
import { useViewStore } from "./viewStore";

interface RenameTarget {
  type: "space" | "orbit" | "node";
  id: string;
  name: string;
}

const RENAME_TITLES: Record<RenameTarget["type"], string> = {
  space: "Rename space",
  orbit: "Rename orbit",
  node: "Rename node",
};

type DeleteTarget = RenameTarget;

const DELETE_TITLES: Record<DeleteTarget["type"], string> = {
  space: "Delete space",
  orbit: "Delete orbit",
  node: "Delete node",
};

const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

interface TreeProps {
  onRequestCreate: (request: PendingCreate) => void;
  onRequestRename: (target: RenameTarget) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestAddRelationship: (sourceId: string) => void;
  onRequestMove: (nodeId: string) => void;
}

export function SidebarTree({
  projectId,
  onRequestCreate,
  onRequestAddRelationship,
  onRequestMove,
}: {
  onRequestCreate: (request: PendingCreate) => void;
  onRequestAddRelationship: (sourceId: string) => void;
  onRequestMove: (nodeId: string) => void;
} & { projectId: string }) {
  const spaces = useModelStore(
    useShallow((state) => spacesInProject(state, projectId)),
  );
  const renameSpace = useModelStore((state) => state.renameSpace);
  const renameOrbit = useModelStore((state) => state.renameOrbit);
  const renameNode = useModelStore((state) => state.renameNode);
  const deleteSpace = useModelStore((state) => state.deleteSpace);
  const deleteOrbit = useModelStore((state) => state.deleteOrbit);
  const deleteNode = useModelStore((state) => state.deleteNode);

  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const deleteDescription = useModelStore((state) => {
    if (!deleteTarget) return null;
    if (deleteTarget.type === "space") {
      const impact = spaceDeleteImpact(state, deleteTarget.id);
      return `This will also delete ${plural(impact.orbits, "orbit")}, ${plural(impact.nodes, "node", "nodes")}, and ${plural(impact.relationships, "relationship")}.`;
    }
    if (deleteTarget.type === "orbit") {
      const count = nodesInOrbit(state, deleteTarget.id).length;
      return `${plural(count, "node", "nodes")} will be ungrouped, not deleted.`;
    }
    const impact = nodeDeleteImpact(state, deleteTarget.id);
    return `This will also delete ${plural(impact.relationships, "relationship")}.`;
  });

  const handleRename = (name: string) => {
    if (!renameTarget) return;
    if (renameTarget.type === "space") renameSpace(renameTarget.id, name);
    else if (renameTarget.type === "orbit") renameOrbit(renameTarget.id, name);
    else renameNode(renameTarget.id, name);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "space") deleteSpace(deleteTarget.id);
    else if (deleteTarget.type === "orbit") deleteOrbit(deleteTarget.id);
    else deleteNode(deleteTarget.id);
  };

  return (
    <div className="space-y-2 text-sm">
      {spaces.map((space, idx) => (
        <Fragment key={space.id}>
          <SpaceRow
            space={space}
            onRequestCreate={onRequestCreate}
            onRequestRename={setRenameTarget}
            onRequestDelete={setDeleteTarget}
            onRequestAddRelationship={onRequestAddRelationship}
            onRequestMove={onRequestMove}
          />
          {idx !== spaces.length - 1 && (
            <div className="my-4 mx-auto w-[calc(100%-1rem)] h-0.5 bg-border/50" />
          )}
        </Fragment>
      ))}
      <CreateDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title={renameTarget ? RENAME_TITLES[renameTarget.type] : ""}
        initialValue={renameTarget?.name}
        submitLabel="Rename"
        onSubmit={handleRename}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget ? `${DELETE_TITLES[deleteTarget.type]} "${deleteTarget.name}"?` : ""}
        description={deleteDescription}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// Wraps a row so right-clicking it opens the shared context menu (rename, view notes,
// visibility where applicable, plus any type-specific "Add ..." items). ContextMenuTrigger's
// `asChild` makes the row div itself the trigger, so Content — despite rendering through a
// Portal — stays a React-tree sibling of the row rather than a descendant of it; selecting an
// item there never bubbles into the row's own onClick, unlike the old options-button dropdown
// which sat nested inside the row's onClick div and needed an explicit stopPropagation guard.
//
// `visibility` is omitted for node rows — visibility is inherited from the parent space/orbit
// rather than toggled independently, so there's no per-node "Visible" checkbox to show.
function RowContextMenu({
  visibility,
  onRename,
  onViewNotes,
  onDelete,
  extraItems,
  children,
}: {
  visibility?: { visible: boolean; onToggleVisible: () => void };
  onRename: () => void;
  onViewNotes: () => void;
  onDelete: () => void;
  extraItems?: React.ReactNode;
  children: React.ReactElement;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={onViewNotes}>View notes</ContextMenuItem>
        {visibility && (
          <>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              checked={visibility.visible}
              onCheckedChange={visibility.onToggleVisible}
            >
              Visible
            </ContextMenuCheckboxItem>
          </>
        )}
        {extraItems && (
          <>
            <ContextMenuSeparator />
            {extraItems}
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="mr-1.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Reserves the real chevron button's exact footprint (same variant/size, no className override)
// so rows with and without expandable children still line up their icons in a column. When not
// expandable, the same button is rendered invisible rather than swapped for a differently sized
// spacer, which is what let the two drift out of alignment previously. Sits at the end of the
// row (after the name) now that the options trigger it used to share that slot with is gone —
// right-click opens the context menu instead.
function ExpandToggle({
  expandable,
  open,
}: {
  expandable: boolean;
  open?: boolean;
}) {
  const chevron = (
    <ChevronRight
      className={cn("size-3.5 transition-transform", open && "rotate-90")}
    />
  );

  if (!expandable) {
    return (
      <Button variant="ghost" size="icon-xs" disabled aria-hidden className="invisible">
        {chevron}
      </Button>
    );
  }

  return (
    <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon-xs">
        {chevron}
      </Button>
    </CollapsibleTrigger>
  );
}

// pl-6 (24px, no margin) keeps the same total indent as before but puts the ul's own box
// origin at the row's left edge, so the dashed line's backgroundPosition below can be
// expressed directly in row-relative pixels instead of fighting an extra margin offset.
const CHILD_LIST_CLASS = "mt-1.5 pl-6 space-y-1.5";
// border-dashed's dash/gap spacing isn't controllable via CSS — the browser derives it from
// border-width. A repeating-linear-gradient background used as a 1px-wide vertical line gives
// explicit control instead: 6px dash, 6px gap, positioned at 12px — the horizontal center of
// each row's leading type icon (size-6 = 24px wide, same footprint the chevron button used to
// occupy before it moved to the end of the row) — so the guide line runs through the icons
// like a standard file-tree. The 12px is hardcoded to that icon size, not derived from it — if
// SidebarTypeIcons' size ever changes, this will drift out of alignment silently (no type
// error, no visual crash, just a line that no longer lines up).
const DASHED_LINE_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 6px, transparent 6px, transparent 12px)",
  backgroundPosition: "12px 0",
  backgroundSize: "1px 100%",
  backgroundRepeat: "no-repeat",
};
const CHILD_CONTENT_CLASS =
  "overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-1";

function SpaceRow({
  space,
  onRequestCreate,
  onRequestRename,
  onRequestDelete,
  onRequestAddRelationship,
  onRequestMove,
}: TreeProps & { space: Space }) {
  const orbits = useModelStore(
    useShallow((state) => orbitsInSpace(state, space.id)),
  );
  const nodes = useModelStore(
    useShallow((state) => ungroupedNodesInSpace(state, space.id)),
  );
  const hidden = useViewStore((state) => state.hiddenSpaceIds.has(space.id));
  const toggleSpaceVisibility = useViewStore(
    (state) => state.toggleSpaceVisibility,
  );
  const focusOn = useViewStore((state) => state.focusOn);
  const openTab = useModelStore((state) => state.openTab);
  // A plain row click only flies the camera (focusTarget), leaving tabs/panel untouched; "View
  // notes" from the context menu opens the tab instead, so "currently focused" has to check both.
  const activeTabId = useModelStore((state) => state.activeTabId);
  const focusTarget = useViewStore((state) => state.focusTarget);
  const isFocused =
    activeTabId === space.id ||
    (focusTarget?.type === "space" && focusTarget.id === space.id);
  const [open, setOpen] = useState(false);
  const hasChildren = orbits.length > 0 || nodes.length > 0;

  // A hidden object has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case.
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <RowContextMenu
        visibility={{ visible: !hidden, onToggleVisible: () => toggleSpaceVisibility(space.id) }}
        onRename={() => onRequestRename({ type: "space", id: space.id, name: space.name })}
        onViewNotes={() => openTab(space.id, "space")}
        onDelete={() => onRequestDelete({ type: "space", id: space.id, name: space.name })}
        extraItems={
          <>
            <ContextMenuItem
              onSelect={() => onRequestCreate({ type: "orbit", spaceId: space.id })}
            >
              <OrbitIcon className="mr-1.5" />
              Add orbit
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => onRequestCreate({ type: "node", spaceId: space.id })}
            >
              <NodeIcon className="mr-1.5" />
              Add node
            </ContextMenuItem>
          </>
        }
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded py-1 font-medium",
            hidden
              ? "text-muted-foreground"
              : "cursor-pointer hover:bg-accent/10",
            isFocused && "bg-accent/10",
          )}
          onClick={hidden ? undefined : () => focusOn(space.id, "space")}
        >
          <SpaceIcon className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {space.label ?? space.name}
          </span>
          {hidden && (
            <EyeOff className="text-muted-foreground size-3.5 shrink-0" aria-label="Hidden" />
          )}
          <ExpandToggle expandable={hasChildren} open={open} />
        </div>
      </RowContextMenu>
      <CollapsibleContent className={CHILD_CONTENT_CLASS}>
        <ul className={CHILD_LIST_CLASS} style={DASHED_LINE_STYLE}>
          {orbits.map((orbit) => (
            <OrbitRow
              key={orbit.id}
              orbit={orbit}
              onRequestCreate={onRequestCreate}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onRequestAddRelationship={onRequestAddRelationship}
              onRequestMove={onRequestMove}
            />
          ))}
          {nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onRequestAddRelationship={onRequestAddRelationship}
              onRequestMove={onRequestMove}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function OrbitRow({
  orbit,
  onRequestCreate,
  onRequestRename,
  onRequestDelete,
  onRequestAddRelationship,
  onRequestMove,
}: TreeProps & { orbit: Orbit }) {
  const nodes = useModelStore(
    useShallow((state) => nodesInOrbit(state, orbit.id)),
  );
  // ownHidden is the orbit's own stored toggle — drives the context menu's "Visible" checkbox,
  // which should reflect what you actually set, not the cascaded result. hidden is the effective
  // (rendered/clickable) state, also accounting for the parent space — previously this only
  // checked the orbit's own flag, missing the space, unlike NodeRow's equivalent check.
  const ownHidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const spaceHidden = useViewStore((state) => state.hiddenSpaceIds.has(orbit.spaceId));
  const hidden = ownHidden || spaceHidden;
  const toggleOrbitVisibility = useViewStore(
    (state) => state.toggleOrbitVisibility,
  );
  const focusOn = useViewStore((state) => state.focusOn);
  const openTab = useModelStore((state) => state.openTab);
  // "Currently focused" can come from either a direct scene click (sets activeTabId, opens a
  // tab) or a sidebar/search click (sets focusTarget only, no tab) — check both.
  const activeTabId = useModelStore((state) => state.activeTabId);
  const focusTarget = useViewStore((state) => state.focusTarget);
  const isFocused =
    activeTabId === orbit.id ||
    (focusTarget?.type === "orbit" && focusTarget.id === orbit.id);
  const [open, setOpen] = useState(false);
  const hasChildren = nodes.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <RowContextMenu
        visibility={{ visible: !ownHidden, onToggleVisible: () => toggleOrbitVisibility(orbit.id) }}
        onRename={() => onRequestRename({ type: "orbit", id: orbit.id, name: orbit.name })}
        onViewNotes={() => openTab(orbit.id, "orbit")}
        onDelete={() => onRequestDelete({ type: "orbit", id: orbit.id, name: orbit.name })}
        extraItems={
          <ContextMenuItem
            onSelect={() =>
              onRequestCreate({
                type: "node",
                spaceId: orbit.spaceId,
                orbitId: orbit.id,
              })
            }
          >
            <NodeIcon className="mr-1.5" />
            Add node
          </ContextMenuItem>
        }
      >
        <div
          className={cn(
            "text-muted-foreground flex items-center gap-2 rounded py-1",
            !hidden && "cursor-pointer hover:bg-accent/10",
            isFocused && "bg-accent/10",
          )}
          onClick={hidden ? undefined : () => focusOn(orbit.id, "orbit")}
        >
          <OrbitIcon className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {orbit.label ?? orbit.name}
          </span>
          {hidden && (
            <EyeOff className="text-muted-foreground size-3.5 shrink-0" aria-label="Hidden" />
          )}
          <ExpandToggle expandable={hasChildren} open={open} />
        </div>
      </RowContextMenu>
      <CollapsibleContent className={CHILD_CONTENT_CLASS}>
        <ul className={CHILD_LIST_CLASS} style={DASHED_LINE_STYLE}>
          {nodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onRequestAddRelationship={onRequestAddRelationship}
              onRequestMove={onRequestMove}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NodeRow({
  node,
  onRequestRename,
  onRequestDelete,
  onRequestAddRelationship,
  onRequestMove,
}: Pick<
  TreeProps,
  "onRequestRename" | "onRequestDelete" | "onRequestAddRelationship" | "onRequestMove"
> & {
  node: Node;
}) {
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);
  const focusOn = useViewStore((state) => state.focusOn);
  const openTab = useModelStore((state) => state.openTab);
  // "Currently focused" can come from either a direct scene click (sets activeTabId, opens a
  // tab) or a sidebar/search click (sets focusTarget only, no tab) — check both.
  const activeTabId = useModelStore((state) => state.activeTabId);
  const focusTarget = useViewStore((state) => state.focusTarget);
  const isFocused =
    activeTabId === node.id ||
    (focusTarget?.type === "node" && focusTarget.id === node.id);
  const hidden =
    hiddenSpaceIds.has(node.spaceId) ||
    (node.orbitId !== undefined && hiddenOrbitIds.has(node.orbitId));
  // relationshipsForNode returns the same Relationship object references the store already
  // holds, so useShallow's one-level comparison is comparing stable elements — unlike building
  // fresh `{id, label}` objects per call here, which would defeat useShallow and risk the
  // getSnapshot-loops-forever bug documented in progress.md. Labels are derived from `nodes`
  // (also a stable Map reference) at render time instead, not inside the selector.
  const relationships = useModelStore(
    useShallow((state) => relationshipsForNode(state, node.id)),
  );
  const nodes = useModelStore((state) => state.nodes);

  return (
    <RowContextMenu
      onRename={() => onRequestRename({ type: "node", id: node.id, name: node.name })}
      onViewNotes={() => openTab(node.id, "node")}
      onDelete={() => onRequestDelete({ type: "node", id: node.id, name: node.name })}
      extraItems={
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Relationships</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {relationships.length === 0 ? (
                <ContextMenuItem disabled>No relationships yet</ContextMenuItem>
              ) : (
                relationships.map((relationship) => {
                  const sourceName = nodes.get(relationship.sourceId)?.name ?? "?";
                  const targetName = nodes.get(relationship.targetId)?.name ?? "?";
                  // Same cardinality → icon mapping as the InfoPanel title: N:M is the one
                  // inherently-bidirectional cardinality, so it borrows the two-way arrow.
                  const CardinalityIcon =
                    relationship.cardinality === "N:M" ? ArrowRightLeft : ArrowRight;
                  return (
                    <ContextMenuItem
                      key={relationship.id}
                      onSelect={() => focusOn(relationship.id, "relationship")}
                    >
                      <span className="min-w-0 truncate">{sourceName}</span>
                      <CardinalityIcon className="mx-1 size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{targetName}</span>
                    </ContextMenuItem>
                  );
                })
              )}
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onRequestAddRelationship(node.id)}>
                <ArrowRightLeft className="mr-1.5" />
                Add relationship
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onSelect={() => onRequestMove(node.id)}>
            <Move className="mr-1.5" />
            Move to...
          </ContextMenuItem>
        </>
      }
    >
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 rounded py-1",
          !hidden && "cursor-pointer hover:bg-accent/10",
          isFocused && "bg-accent/10",
        )}
        onClick={hidden ? undefined : () => focusOn(node.id, "node")}
      >
        <NodeIcon className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {hidden && (
          <EyeOff className="text-muted-foreground size-3.5 shrink-0" aria-label="Hidden" />
        )}
      </div>
    </RowContextMenu>
  );
}
