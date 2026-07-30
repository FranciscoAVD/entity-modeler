import type { Entity } from "@/store/types";
import { ENTITY_COLOR } from "./colors";
import { RadialLabel } from "./RadialLabel";

// Not GPU-instanced yet — fine at the node counts this tool targets (schemas/topologies,
// not point clouds). Revisit with THREE.InstancedMesh under Phase 10 if profiling calls for it.
const ENTITY_RADIUS = 0.6;

export function EntityNode({ entity }: { entity: Entity }) {
  return (
    <group position={[entity.position.x, entity.position.y, entity.position.z]}>
      <mesh>
        <sphereGeometry args={[ENTITY_RADIUS, 24, 16]} />
        <meshStandardMaterial color={ENTITY_COLOR} roughness={0.4} metalness={0.1} />
      </mesh>
      <RadialLabel text={entity.name} radius={ENTITY_RADIUS} color={ENTITY_COLOR} fontSize={0.35} margin={0.25} />
    </group>
  );
}
