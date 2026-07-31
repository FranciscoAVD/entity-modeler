import type { ThreeEvent } from "@react-three/fiber";
import { useModelStore } from "@/store/store";
import type { Entity } from "@/store/types";
import { ENTITY_COLOR } from "./colors";
import { RadialLabel } from "./RadialLabel";

// Not GPU-instanced yet — fine at the node counts this tool targets (schemas/topologies,
// not point clouds). Revisit with THREE.InstancedMesh under Phase 10 if profiling calls for it.
const ENTITY_RADIUS = 0.6;

export function EntityNode({ entity }: { entity: Entity }) {
  const isActive = useModelStore((state) => state.activeTabId === entity.id);
  const openTab = useModelStore((state) => state.openTab);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    openTab(entity.id, "entity");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[entity.position.x, entity.position.y, entity.position.z]}>
      <mesh
        userData={{ entityId: entity.id }}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[ENTITY_RADIUS, 24, 16]} />
        <meshStandardMaterial
          color={ENTITY_COLOR}
          roughness={0.4}
          metalness={0.1}
          emissive={isActive ? ENTITY_COLOR : "#000000"}
          emissiveIntensity={isActive ? 0.8 : 0}
        />
      </mesh>
      <RadialLabel text={entity.name} radius={ENTITY_RADIUS} color={ENTITY_COLOR} fontSize={0.35} margin={0.25} />
    </group>
  );
}
