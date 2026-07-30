import { useModelStore } from "@/store/store";
import type { Orbit } from "@/store/types";
import { BoundaryLabel } from "./BoundaryLabel";
import { BoundarySphere } from "./BoundarySphere";
import { computeOrbitRadius, isOrbitEmpty } from "./bounds";
import { ORBIT_COLOR } from "./colors";
import { useViewStore } from "./viewStore";

export function OrbitBoundary({ orbit }: { orbit: Orbit }) {
  const radius = useModelStore((state) => computeOrbitRadius(state, orbit.id));
  const empty = useModelStore((state) => isOrbitEmpty(state, orbit.id));
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));

  if (hidden) return null;

  return (
    <group position={[orbit.origin.x, orbit.origin.y, orbit.origin.z]}>
      <BoundarySphere radius={radius} color={ORBIT_COLOR} empty={empty} />
      <BoundaryLabel text={orbit.label ?? orbit.name} radius={radius} color={ORBIT_COLOR} dimmer />
    </group>
  );
}
