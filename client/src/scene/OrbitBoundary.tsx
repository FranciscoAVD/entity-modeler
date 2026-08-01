import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { entitiesInOrbit } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Orbit } from "@/store/types";
import { BoundaryLabel } from "./BoundaryLabel";
import { BoundarySphere } from "./BoundarySphere";
import { computeOrbitRadius, isOrbitEmpty } from "./bounds";
import { ORBIT_COLOR } from "./SidebarTypeIcons";
import { EntityNode } from "./EntityNode";
import { useViewStore } from "./viewStore";

export function OrbitBoundary({ orbit }: { orbit: Orbit }) {
  const entities = useModelStore(useShallow((state) => entitiesInOrbit(state, orbit.id)));
  const radius = useModelStore((state) => computeOrbitRadius(state, orbit.id));
  const empty = useModelStore((state) => isOrbitEmpty(state, orbit.id));
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const isActive = useModelStore((state) => state.activeTabId === orbit.id);
  const openTab = useModelStore((state) => state.openTab);
  const [hovered, setHovered] = useState(false);
  // Hover previews the same boundary opacity boost as "active" (see BoundarySphere), so the
  // mouse's target is obvious before a click commits to it.
  const highlighted = isActive || hovered;

  if (hidden) return null;

  // A click aimed at an entity (or an edge between two of its entities) also intersects
  // this orbit's own hit volume first (it's nearer along the ray). Defer to whichever is
  // present — matches the plan's "raycast against sphere meshes, keyed via userData.entityId".
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const hitMoreSpecific = e.intersections.some(
      (i) => i.object.userData?.entityId || i.object.userData?.relationshipId,
    );
    if (hitMoreSpecific) return;
    e.stopPropagation();
    openTab(orbit.id, "orbit");
  };

  // Same deferral as the click handler above: without it, hovering a nested entity would
  // also light up this orbit's (nearer, larger) boundary, muddying which object is the
  // actual click target.
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = "pointer";
    const hitMoreSpecific = e.intersections.some(
      (i) => i.object.userData?.entityId || i.object.userData?.relationshipId,
    );
    if (hitMoreSpecific) return;
    e.stopPropagation();
    setHovered(true);
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
    setHovered(false);
  };

  return (
    <group position={[orbit.origin.x, orbit.origin.y, orbit.origin.z]}>
      <BoundarySphere radius={radius} color={ORBIT_COLOR} empty={empty} active={highlighted} />
      <BoundaryLabel text={orbit.label ?? orbit.name} radius={radius} color={ORBIT_COLOR} dimmer />
      <mesh onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {entities.map((entity) => (
        <EntityNode key={entity.id} entity={entity} />
      ))}
    </group>
  );
}
