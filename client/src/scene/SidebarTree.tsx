import { ArrowRightLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
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
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  entitiesInOrbit,
  orbitsInSpace,
  spacesInProject,
  ungroupedEntitiesInSpace,
} from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Entity, Orbit, Space } from "@/store/types";
import { CreateDialog } from "./CreateDialog";
import type { PendingCreate } from "./Sidebar";
import { EntityIcon, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
import { useViewStore } from "./viewStore";

interface RenameTarget {
  type: "space" | "orbit" | "entity";
  id: string;
  name: string;
}

const RENAME_TITLES: Record<RenameTarget["type"], string> = {
  space: "Rename space",
  orbit: "Rename orbit",
  entity: "Rename node",
};

interface TreeProps {
  onRequestCreate: (request: PendingCreate) => void;
  onRequestRename: (target: RenameTarget) => void;
  onRequestAddRelationship: (sourceId: string) => void;
}

export function SidebarTree({
  projectId,
  onRequestCreate,
  onRequestAddRelationship,
}: {
  onRequestCreate: (request: PendingCreate) => void;
  onRequestAddRelationship: (sourceId: string) => void;
} & { projectId: string }) {
  const spaces = useModelStore(
    useShallow((state) => spacesInProject(state, projectId)),
  );
  const renameSpace = useModelStore((state) => state.renameSpace);
  const renameOrbit = useModelStore((state) => state.renameOrbit);
  const renameEntity = useModelStore((state) => state.renameEntity);

  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);

  const handleRename = (name: string) => {
    if (!renameTarget) return;
    if (renameTarget.type === "space") renameSpace(renameTarget.id, name);
    else if (renameTarget.type === "orbit") renameOrbit(renameTarget.id, name);
    else renameEntity(renameTarget.id, name);
  };

  return (
    <div className="space-y-2 text-sm">
      {spaces.map((space, idx) => (
        <>
          <SpaceRow
            key={space.id}
            space={space}
            onRequestCreate={onRequestCreate}
            onRequestRename={setRenameTarget}
            onRequestAddRelationship={onRequestAddRelationship}
          />
          {idx !== spaces.length - 1 && (
            <div className="my-4 mx-auto w-[calc(100%-1rem)] h-0.5 bg-border/50" />
          )}
        </>
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
// `visibility` is omitted for entity rows — visibility is inherited from the parent space/orbit
// rather than toggled independently, so there's no per-entity "Visible" checkbox to show.
function RowContextMenu({
  visibility,
  onRename,
  onViewNotes,
  extraItems,
  children,
}: {
  visibility?: { visible: boolean; onToggleVisible: () => void };
  onRename: () => void;
  onViewNotes: () => void;
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
  onRequestAddRelationship,
}: TreeProps & { space: Space }) {
  const orbits = useModelStore(
    useShallow((state) => orbitsInSpace(state, space.id)),
  );
  const nodes = useModelStore(
    useShallow((state) => ungroupedEntitiesInSpace(state, space.id)),
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
  const [open, setOpen] = useState(true);
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
              <EntityIcon className="mr-1.5" />
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
              onRequestAddRelationship={onRequestAddRelationship}
            />
          ))}
          {nodes.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              onRequestRename={onRequestRename}
              onRequestAddRelationship={onRequestAddRelationship}
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
  onRequestAddRelationship,
}: TreeProps & { orbit: Orbit }) {
  const nodes = useModelStore(
    useShallow((state) => entitiesInOrbit(state, orbit.id)),
  );
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
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
        visibility={{ visible: !hidden, onToggleVisible: () => toggleOrbitVisibility(orbit.id) }}
        onRename={() => onRequestRename({ type: "orbit", id: orbit.id, name: orbit.name })}
        onViewNotes={() => openTab(orbit.id, "orbit")}
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
            <EntityIcon className="mr-1.5" />
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
          <ExpandToggle expandable={hasChildren} open={open} />
        </div>
      </RowContextMenu>
      <CollapsibleContent className={CHILD_CONTENT_CLASS}>
        <ul className={CHILD_LIST_CLASS} style={DASHED_LINE_STYLE}>
          {nodes.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              onRequestRename={onRequestRename}
              onRequestAddRelationship={onRequestAddRelationship}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntityRow({
  entity,
  onRequestRename,
  onRequestAddRelationship,
}: Pick<TreeProps, "onRequestRename" | "onRequestAddRelationship"> & {
  entity: Entity;
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
    activeTabId === entity.id ||
    (focusTarget?.type === "entity" && focusTarget.id === entity.id);
  const hidden =
    hiddenSpaceIds.has(entity.spaceId) ||
    (entity.orbitId !== undefined && hiddenOrbitIds.has(entity.orbitId));

  return (
    <RowContextMenu
      onRename={() => onRequestRename({ type: "entity", id: entity.id, name: entity.name })}
      onViewNotes={() => openTab(entity.id, "entity")}
      extraItems={
        <ContextMenuItem onSelect={() => onRequestAddRelationship(entity.id)}>
          <ArrowRightLeft className="mr-1.5" />
          Add relationship
        </ContextMenuItem>
      }
    >
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 rounded py-1",
          !hidden && "cursor-pointer hover:bg-accent/10",
          isFocused && "bg-accent/10",
        )}
        onClick={hidden ? undefined : () => focusOn(entity.id, "entity")}
      >
        <EntityIcon className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{entity.name}</span>
      </div>
    </RowContextMenu>
  );
}
