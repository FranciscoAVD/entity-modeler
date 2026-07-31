import { OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { type ComponentRef, useRef } from "react";
import * as THREE from "three";
import { useModelStore } from "@/store/store";
import type { Entity } from "@/store/types";
import { ENTITY_COLOR } from "./colors";
import { RadialLabel } from "./RadialLabel";

// Not GPU-instanced yet — fine at the node counts this tool targets (schemas/topologies,
// not point clouds). Revisit with THREE.InstancedMesh under Phase 10 if profiling calls for it.
const ENTITY_RADIUS = 0.6;
// Pointer travel below this (px) between down and up counts as a click, not a drag.
const DRAG_THRESHOLD_PX = 4;
const DEPTH_DRAG_SPEED = 0.03;

export function EntityNode({ entity }: { entity: Entity }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as ComponentRef<typeof OrbitControls> | null;
  const groupRef = useRef<THREE.Group>(null);

  const isActive = useModelStore((state) => state.activeTabId === entity.id);
  const openTab = useModelStore((state) => state.openTab);
  const updateEntityPosition = useModelStore((state) => state.updateEntityPosition);

  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());
  const pointerDownScreen = useRef(new THREE.Vector2());
  const didDrag = useRef(false);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;

    didDrag.current = false;
    pointerDownScreen.current.set(e.clientX, e.clientY);

    const worldPos = new THREE.Vector3();
    groupRef.current?.getWorldPosition(worldPos);
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, worldPos);
    dragOffset.current.copy(worldPos).sub(e.point);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.buttons === 0 || !groupRef.current) return;
    e.stopPropagation();

    const dx = e.clientX - pointerDownScreen.current.x;
    const dy = e.clientY - pointerDownScreen.current.y;
    if (!didDrag.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) didDrag.current = true;
    if (!didDrag.current) return;

    let newWorldPos: THREE.Vector3;
    if (e.shiftKey) {
      // Shift+drag moves along the camera's forward axis instead of the camera plane —
      // dragging up (negative movementY) pushes the node away from the camera.
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      newWorldPos = worldPos.addScaledVector(forward, -e.movementY * DEPTH_DRAG_SPEED);
      dragPlane.current.setFromNormalAndCoplanarPoint(forward, newWorldPos);
      dragOffset.current.copy(newWorldPos).sub(e.point);
    } else {
      const point = new THREE.Vector3();
      if (!e.ray.intersectPlane(dragPlane.current, point)) return;
      newWorldPos = point.add(dragOffset.current);
    }

    const parentWorldPos = new THREE.Vector3();
    groupRef.current.parent?.getWorldPosition(parentWorldPos);
    const local = newWorldPos.sub(parentWorldPos);
    updateEntityPosition(entity.id, { x: local.x, y: local.y, z: local.z });
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (controls) controls.enabled = true;
    if (!didDrag.current) openTab(entity.id, "entity");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group ref={groupRef} position={[entity.position.x, entity.position.y, entity.position.z]}>
      <mesh
        userData={{ entityId: entity.id }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
