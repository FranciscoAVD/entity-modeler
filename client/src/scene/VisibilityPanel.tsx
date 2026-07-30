import { useShallow } from "zustand/react/shallow";
import { Checkbox } from "@/components/ui/checkbox";
import { orbitsInSpace, spacesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Space } from "@/store/types";
import { useViewStore } from "./viewStore";

export function VisibilityPanel({ projectId }: { projectId: string }) {
  const spaces = useModelStore(useShallow((state) => spacesInProject(state, projectId)));

  return (
    <div className="bg-card/90 text-card-foreground border-border absolute top-4 left-4 w-56 space-y-2 rounded-lg border p-3 text-sm backdrop-blur">
      {spaces.map((space) => (
        <SpaceVisibilityRow key={space.id} space={space} />
      ))}
    </div>
  );
}

function SpaceVisibilityRow({ space }: { space: Space }) {
  const orbits = useModelStore(useShallow((state) => orbitsInSpace(state, space.id)));
  const hidden = useViewStore((state) => state.hiddenSpaceIds.has(space.id));
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);
  const toggleSpaceVisibility = useViewStore((state) => state.toggleSpaceVisibility);
  const toggleOrbitVisibility = useViewStore((state) => state.toggleOrbitVisibility);

  return (
    <div>
      <label className="flex items-center gap-2 font-medium">
        <Checkbox checked={!hidden} onCheckedChange={() => toggleSpaceVisibility(space.id)} />
        {space.label ?? space.name}
      </label>
      <div className="mt-1 ml-6 space-y-1">
        {orbits.map((orbit) => (
          <label key={orbit.id} className="text-muted-foreground flex items-center gap-2">
            <Checkbox
              checked={!hiddenOrbitIds.has(orbit.id)}
              onCheckedChange={() => toggleOrbitVisibility(orbit.id)}
            />
            {orbit.label ?? orbit.name}
          </label>
        ))}
      </div>
    </div>
  );
}
