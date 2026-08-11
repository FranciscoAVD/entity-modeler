import type { ThreeEvent } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import { orbitsInSpace, ungroupedNodesInSpace } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Space } from "@/store/types";
import { BoundaryLabel } from "./BoundaryLabel";
import { BoundarySphere } from "./BoundarySphere";
import { computeSpaceRadius, isSpaceEmpty } from "./bounds";
import { SPACE_COLOR } from "./SidebarTypeIcons";
import { Node } from "./Node";
import { OrbitBoundary } from "./OrbitBoundary";
import { useViewStore } from "./viewStore";

export function SpaceBoundary({ space }: { space: Space }) {
  const orbits = useModelStore(useShallow((state) => orbitsInSpace(state, space.id)));
  const ungroupedNodes = useModelStore(
    useShallow((state) => ungroupedNodesInSpace(state, space.id)),
  );
  const radius = useModelStore((state) => computeSpaceRadius(state, space.id));
  const empty = useModelStore((state) => isSpaceEmpty(state, space.id));
  const hidden = useViewStore((state) => state.hiddenSpaceIds.has(space.id));
  const isActive = useModelStore((state) => state.activeTabId === space.id);
  const openTab = useModelStore((state) => state.openTab);
  const focusOn = useViewStore((state) => state.focusOn);

  if (hidden) return null;

  // A click aimed at an orbit (or a node/edge nested inside one, or an ungrouped node
  // directly in this space) also intersects this space's own hit volume first, since it's the
  // outermost sphere along the ray. Defer to whichever is more specific — same pattern
  // OrbitBoundary uses to yield to the nodes/edges nested inside it.
  const hitMoreSpecific = (e: ThreeEvent<MouseEvent>) =>
    e.intersections.some(
      (i) =>
        i.object.userData?.nodeId ||
        i.object.userData?.relationshipId ||
        i.object.userData?.orbitId,
    );

  // Single click only moves the camera (same as a sidebar row click); the panel only opens on
  // double-click, or via the sidebar's "View notes" context menu item.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitMoreSpecific(e)) return;
    e.stopPropagation();
    focusOn(space.id, "space");
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitMoreSpecific(e)) return;
    e.stopPropagation();
    openTab(space.id, "space");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[space.origin.x, space.origin.y, space.origin.z]}>
      <BoundarySphere radius={radius} color={SPACE_COLOR} empty={empty} active={isActive} />
      <BoundaryLabel text={space.label ?? space.name} radius={radius} color={SPACE_COLOR} />
      <mesh
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[radius, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {orbits.map((orbit) => (
        <OrbitBoundary key={orbit.id} orbit={orbit} />
      ))}
      {ungroupedNodes.map((node) => (
        <Node key={node.id} node={node} />
      ))}
    </group>
  );
}
