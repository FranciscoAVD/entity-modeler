import type { ThreeEvent } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import { nodesInOrbit } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Orbit } from "@/store/types";
import { BoundaryLabel } from "./BoundaryLabel";
import { BoundarySphere } from "./BoundarySphere";
import { computeOrbitRadius, isOrbitEmpty } from "./bounds";
import { ORBIT_COLOR } from "./SidebarTypeIcons";
import { Node } from "./Node";
import { useViewStore } from "./viewStore";

export function OrbitBoundary({ orbit }: { orbit: Orbit }) {
  const nodes = useModelStore(useShallow((state) => nodesInOrbit(state, orbit.id)));
  const radius = useModelStore((state) => computeOrbitRadius(state, orbit.id));
  const empty = useModelStore((state) => isOrbitEmpty(state, orbit.id));
  const hidden = useViewStore((state) => state.hiddenOrbitIds.has(orbit.id));
  const isActive = useModelStore((state) => state.activeTabId === orbit.id);
  const openTab = useModelStore((state) => state.openTab);
  const focusOn = useViewStore((state) => state.focusOn);

  if (hidden) return null;

  // A click aimed at a node (or an edge between two of its nodes) also intersects
  // this orbit's own hit volume first (it's nearer along the ray). Defer to whichever is
  // present — matches the plan's "raycast against sphere meshes, keyed via userData.nodeId".
  const hitMoreSpecific = (e: ThreeEvent<MouseEvent>) =>
    e.intersections.some((i) => i.object.userData?.nodeId || i.object.userData?.relationshipId);

  // Single click only moves the camera (same as a sidebar row click); the panel only opens on
  // double-click, or via the sidebar's "View notes" context menu item.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitMoreSpecific(e)) return;
    e.stopPropagation();
    focusOn(orbit.id, "orbit");
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitMoreSpecific(e)) return;
    e.stopPropagation();
    openTab(orbit.id, "orbit");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[orbit.origin.x, orbit.origin.y, orbit.origin.z]}>
      <BoundarySphere radius={radius} color={ORBIT_COLOR} empty={empty} active={isActive} />
      <BoundaryLabel text={orbit.label ?? orbit.name} radius={radius} color={ORBIT_COLOR} dimmer />
      <mesh
        userData={{ orbitId: orbit.id }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[radius, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {nodes.map((node) => (
        <Node key={node.id} node={node} />
      ))}
    </group>
  );
}
