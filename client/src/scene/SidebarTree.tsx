import { MoreVertical } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
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
import { TYPE_ICONS } from "./typeIcons";
import { useViewStore } from "./viewStore";
import { SPACE_COLOR, ORBIT_COLOR, ENTITY_COLOR } from "./colors";

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
      {spaces.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          onRequestCreate={onRequestCreate}
        />
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label} options`}
          className="hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
        >
          <MoreVertical className="size-3.5" />
        </button>
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
  const SpaceIcon = TYPE_ICONS.space;
  const OrbitIcon = TYPE_ICONS.orbit;
  const EntityIcon = TYPE_ICONS.entity;

  return (
    <div>
      <div
        className={`flex items-center gap-2 font-medium ${hidden ? "text-muted-foreground" : ""}`}
      >
        <SpaceIcon
          color={SPACE_COLOR}
          className="size-6 shrink-0 bg-space/10 p-1 rounded-full"
        />
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
            <OrbitIcon
              color={ORBIT_COLOR}
              className="mr-1.5 size-6 bg-orbit/10 p-1 rounded-full"
            />
            Add orbit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onRequestCreate({ type: "node", spaceId: space.id })
            }
          >
            <EntityIcon
              color={ENTITY_COLOR}
              className="mr-1.5 size-6 p-1 bg-entity/10 rounded-full"
            />
            Add node
          </DropdownMenuItem>
        </OptionsMenu>
      </div>
      <div className="mt-1.5 ml-5 space-y-1.5">
        {orbits.map((orbit) => (
          <OrbitRow
            key={orbit.id}
            orbit={orbit}
            onRequestCreate={onRequestCreate}
          />
        ))}
      </div>
    </div>
  );
}

function OrbitRow({ orbit, onRequestCreate }: TreeProps & { orbit: Orbit }) {
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const toggleOrbitVisibility = useViewStore(
    (state) => state.toggleOrbitVisibility,
  );
  const OrbitIcon = TYPE_ICONS.orbit;
  const EntityIcon = TYPE_ICONS.entity;

  return (
    <div className="text-muted-foreground flex items-center gap-2">
      <OrbitIcon
        color={ORBIT_COLOR}
        className="size-6 p-1 bg-orbit/10 shrink-0 rounded-full"
      />
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
          <EntityIcon
            color={ENTITY_COLOR}
            className="mr-1.5 size-6 p-1 bg-entity/10 rounded-full"
          />
          Add node
        </DropdownMenuItem>
      </OptionsMenu>
    </div>
  );
}
