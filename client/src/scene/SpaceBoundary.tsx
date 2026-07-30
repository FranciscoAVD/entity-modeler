import { useShallow } from "zustand/react/shallow";
import { orbitsInSpace } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Space } from "@/store/types";
import { BoundaryLabel } from "./BoundaryLabel";
import { BoundarySphere } from "./BoundarySphere";
import { computeSpaceRadius, isSpaceEmpty } from "./bounds";
import { SPACE_COLOR } from "./colors";
import { OrbitBoundary } from "./OrbitBoundary";
import { useViewStore } from "./viewStore";

export function SpaceBoundary({ space }: { space: Space }) {
  const orbits = useModelStore(useShallow((state) => orbitsInSpace(state, space.id)));
  const radius = useModelStore((state) => computeSpaceRadius(state, space.id));
  const empty = useModelStore((state) => isSpaceEmpty(state, space.id));
  const hidden = useViewStore((state) => state.hiddenSpaceIds.has(space.id));

  if (hidden) return null;

  return (
    <group position={[space.origin.x, space.origin.y, space.origin.z]}>
      <BoundarySphere radius={radius} color={SPACE_COLOR} empty={empty} />
      <BoundaryLabel text={space.label ?? space.name} radius={radius} color={SPACE_COLOR} />
      {orbits.map((orbit) => (
        <OrbitBoundary key={orbit.id} orbit={orbit} />
      ))}
    </group>
  );
}
