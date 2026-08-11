import type { ThreeEvent } from "@react-three/fiber";
import { useModelStore } from "@/store/store";
import type { Node } from "@/store/types";
import { NODE_RADIUS } from "./bounds";
import { NODE_COLOR } from "./SidebarTypeIcons";
import { RadialLabel } from "./RadialLabel";
import { useViewStore } from "./viewStore";

// Not GPU-instanced yet — fine at the node counts this tool targets (schemas/topologies,
// not point clouds). Revisit with THREE.InstancedMesh under Phase 10 if profiling calls for it.
// Re-exported (defined in bounds.ts, which has no React/R3F dependency) so edge rendering can
// still trim curves back to the sphere's surface instead of its center via the same import path.
export { NODE_RADIUS };

export function Node({ node }: { node: Node }) {
  const isActive = useModelStore((state) => state.activeTabId === node.id);
  const openTab = useModelStore((state) => state.openTab);
  const focusOn = useViewStore((state) => state.focusOn);

  // Single click only moves the camera (same as a sidebar row click); the panel only opens on
  // double-click, or via the sidebar's "View notes" context menu item.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    focusOn(node.id, "node");
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    openTab(node.id, "node");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      <mesh
        userData={{ nodeId: node.id }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[NODE_RADIUS, 24, 16]} />
        <meshStandardMaterial
          color={NODE_COLOR}
          roughness={0.4}
          metalness={0.1}
          emissive={isActive ? NODE_COLOR : "#000000"}
          emissiveIntensity={isActive ? 0.8 : 0}
        />
      </mesh>
      <RadialLabel text={node.name} radius={NODE_RADIUS} color={NODE_COLOR} fontSize={0.35} margin={0.25} />
    </group>
  );
}
