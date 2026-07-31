import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useRef } from "react";
import * as THREE from "three";
import { useModelStore } from "@/store/store";
import { DEFAULT_CAMERA_POSITION, resolveCameraFocus } from "./cameraFocus";
import { useViewStore } from "./viewStore";

const DEFAULT_CAMERA_POSITION_VEC = new THREE.Vector3(
  DEFAULT_CAMERA_POSITION.x,
  DEFAULT_CAMERA_POSITION.y,
  DEFAULT_CAMERA_POSITION.z,
);
// Every fly-to keeps this same approach angle, so the camera never flips to a
// disorienting side as it moves between objects (plan.md: "preserve spatial orientation").
const APPROACH_DIRECTION = DEFAULT_CAMERA_POSITION_VEC.clone().normalize();
const FLY_DURATION_MS = 600;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

interface Tween {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startTime: number;
}

export function CameraRig() {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const tweenRef = useRef<Tween | null>(null);
  const focusKeyRef = useRef<string>("__initial__");
  const prevResetTokenRef = useRef(0);

  const activeTabId = useModelStore((state) => state.activeTabId);
  const resetViewToken = useViewStore((state) => state.resetViewToken);

  // Recomputes the fly-to target only when the active tab or a reset request changes,
  // not every frame — the per-frame animation itself lives in useFrame below.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const resetRequested = resetViewToken !== prevResetTokenRef.current;
    prevResetTokenRef.current = resetViewToken;

    const focus = resolveCameraFocus(useModelStore.getState(), resetViewToken, resetRequested);
    if (focus.key === focusKeyRef.current) return;
    focusKeyRef.current = focus.key;

    const toTarget = new THREE.Vector3(focus.target.x, focus.target.y, focus.target.z);
    const toPosition = toTarget.clone().addScaledVector(APPROACH_DIRECTION, focus.distance);

    tweenRef.current = {
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget,
      startTime: performance.now(),
    };
  }, [activeTabId, resetViewToken, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const tween = tweenRef.current;
    if (tween) {
      const t = Math.min((performance.now() - tween.startTime) / FLY_DURATION_MS, 1);
      const eased = easeInOutCubic(t);
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      if (t >= 1) tweenRef.current = null;
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2}
      maxDistance={80}
    />
  );
}
