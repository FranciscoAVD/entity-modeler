import { MoreVertical } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orbitsInSpace, spacesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Orbit, Space } from "@/store/types";
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
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${label} options`}
            className="text-muted-foreground size-auto shrink-0 rounded p-0.5"
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

function SpaceRow({ space, onRequestCreate }: TreeProps & { space: Space }) {
  const orbits = useModelStore(
    useShallow((state) => orbitsInSpace(state, space.id)),
  );
  const hidden = useViewStore((state) => state.hiddenSpaceIds.has(space.id));
  const toggleSpaceVisibility = useViewStore(
    (state) => state.toggleSpaceVisibility,
  );
  const focusOn = useViewStore((state) => state.focusOn);

  // A hidden object has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case.
  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded font-medium ${
          hidden ? "text-muted-foreground" : "cursor-pointer hover:bg-muted/50"
        }`}
        onClick={hidden ? undefined : () => focusOn(space.id, "space")}
      >
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
      <ul className="border-l border-dashed mt-1.5 ml-2 pl-4 space-y-1.5">
        {orbits.map((orbit) => (
          <OrbitRow
            key={orbit.id}
            orbit={orbit}
            onRequestCreate={onRequestCreate}
          />
        ))}
      </ul>
    </div>
  );
}

function OrbitRow({ orbit, onRequestCreate }: TreeProps & { orbit: Orbit }) {
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const toggleOrbitVisibility = useViewStore(
    (state) => state.toggleOrbitVisibility,
  );
  const focusOn = useViewStore((state) => state.focusOn);

  return (
    <div
      className={`text-muted-foreground flex items-center gap-2 rounded ${
        hidden ? "" : "cursor-pointer hover:bg-muted/50"
      }`}
      onClick={hidden ? undefined : () => focusOn(orbit.id, "orbit")}
    >
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
  );
}
