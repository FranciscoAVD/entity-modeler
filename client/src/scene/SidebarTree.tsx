import { ChevronRight, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  entitiesInOrbit,
  orbitsInSpace,
  spacesInProject,
  ungroupedEntitiesInSpace,
} from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Entity, Orbit, Space } from "@/store/types";
import type { PendingCreate } from "./Sidebar";
import { EntityIcon, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
import { useViewStore } from "./viewStore";

interface TreeProps {
  onRequestCreate: (request: PendingCreate) => void;
}

export function SidebarTree({
  projectId,
  onRequestCreate,
}: TreeProps & { projectId: string }) {
  const spaces = useModelStore(
    useShallow((state) => spacesInProject(state, projectId)),
  );

  return (
    <div className="space-y-2 text-sm">
      {spaces.map((space, idx) => (
        <>
          <SpaceRow
            key={space.id}
            space={space}
            onRequestCreate={onRequestCreate}
          />
          {idx !== spaces.length - 1 && (
            <div className="my-4 mx-auto w-[calc(100%-1rem)] h-0.5 bg-border/50" />
          )}
        </>
      ))}
    </div>
  );
}

function OptionsMenu({
  label,
  visible,
  onToggleVisible,
  children,
}: {
  label: string;
  visible: boolean;
  onToggleVisible: () => void;
  children: React.ReactNode;
}) {
  // DropdownMenuContent renders through a Portal, but React still bubbles its synthetic click
  // events along the *component* tree (not the DOM tree) — so without this, picking "Visible"
  // or an "Add ..." item here would also fire the row's own onClick={() => focusOn(...)} above it.
  return (
    <div
      className="flex items-center pr-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${label} options`}
            className="size-auto shrink-0 rounded p-0.5"
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={visible}
            onCheckedChange={onToggleVisible}
          >
            Visible
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Reserves the real chevron button's exact footprint (same variant/size, no className override)
// so rows with and without expandable children still line up their type icons in a column. When
// not expandable, the same button is rendered invisible rather than swapped for a differently
// sized spacer, which is what let the two drift out of alignment previously.
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
// the chevron button above it (icon-xs Button, size-6 = 24px wide) — so the guide line runs
// through the toggle icons like a standard file-tree. The 12px is hardcoded to that button
// size, not derived from it — if ExpandToggle's button size ever changes, this will drift out
// of alignment silently (no type error, no visual crash, just a line that no longer lines up).
const DASHED_LINE_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 6px, transparent 6px, transparent 12px)",
  backgroundPosition: "12px 0",
  backgroundSize: "1px 100%",
  backgroundRepeat: "no-repeat",
};
const CHILD_CONTENT_CLASS =
  "overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-1";

function SpaceRow({ space, onRequestCreate }: TreeProps & { space: Space }) {
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
  // Spaces are never opened as tabs (plan.md: "Spaces: not part of the reveal flow"), so
  // focusTarget — set by this row's own click and by search — is the only "currently focused"
  // signal that applies to them.
  const focusTarget = useViewStore((state) => state.focusTarget);
  const isFocused = focusTarget?.type === "space" && focusTarget.id === space.id;
  const [open, setOpen] = useState(true);
  const hasChildren = orbits.length > 0 || nodes.length > 0;

  // A hidden object has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case.
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
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
        <ExpandToggle expandable={hasChildren} open={open} />
        <SpaceIcon className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {space.label ?? space.name}
        </span>
        <OptionsMenu
          label={space.name}
          visible={!hidden}
          onToggleVisible={() => toggleSpaceVisibility(space.id)}
        >
          <DropdownMenuItem
            onSelect={() =>
              onRequestCreate({ type: "orbit", spaceId: space.id })
            }
          >
            <OrbitIcon className="mr-1.5" />
            Add orbit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onRequestCreate({ type: "node", spaceId: space.id })
            }
          >
            <EntityIcon className="mr-1.5" />
            Add node
          </DropdownMenuItem>
        </OptionsMenu>
      </div>
      <CollapsibleContent className={CHILD_CONTENT_CLASS}>
        <ul className={CHILD_LIST_CLASS} style={DASHED_LINE_STYLE}>
          {orbits.map((orbit) => (
            <OrbitRow
              key={orbit.id}
              orbit={orbit}
              onRequestCreate={onRequestCreate}
            />
          ))}
          {nodes.map((entity) => (
            <EntityRow key={entity.id} entity={entity} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function OrbitRow({ orbit, onRequestCreate }: TreeProps & { orbit: Orbit }) {
  const nodes = useModelStore(
    useShallow((state) => entitiesInOrbit(state, orbit.id)),
  );
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const toggleOrbitVisibility = useViewStore(
    (state) => state.toggleOrbitVisibility,
  );
  const focusOn = useViewStore((state) => state.focusOn);
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
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 rounded py-1",
          !hidden && "cursor-pointer hover:bg-accent/10",
          isFocused && "bg-accent/10",
        )}
        onClick={hidden ? undefined : () => focusOn(orbit.id, "orbit")}
      >
        <ExpandToggle expandable={hasChildren} open={open} />
        <OrbitIcon className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {orbit.label ?? orbit.name}
        </span>
        <OptionsMenu
          label={orbit.name}
          visible={!hidden}
          onToggleVisible={() => toggleOrbitVisibility(orbit.id)}
        >
          <DropdownMenuItem
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
          </DropdownMenuItem>
        </OptionsMenu>
      </div>
      <CollapsibleContent className={CHILD_CONTENT_CLASS}>
        <ul className={CHILD_LIST_CLASS} style={DASHED_LINE_STYLE}>
          {nodes.map((entity) => (
            <EntityRow key={entity.id} entity={entity} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntityRow({ entity }: { entity: Entity }) {
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);
  const focusOn = useViewStore((state) => state.focusOn);
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
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-2 rounded py-1",
        !hidden && "cursor-pointer hover:bg-accent/10",
        isFocused && "bg-accent/10",
      )}
      onClick={hidden ? undefined : () => focusOn(entity.id, "entity")}
    >
      <ExpandToggle expandable={false} />
      <EntityIcon className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{entity.name}</span>
    </div>
  );
}
