import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

interface RadialLabelProps {
  text: string;
  radius: number;
  color: string;
  fontSize: number;
  margin?: number;
  outlineOpacity?: number;
  fillOpacity?: number;
}

const tempWorldPos = new THREE.Vector3();
const tempDir = new THREE.Vector3();
const FALLBACK_DIR = new THREE.Vector3(0, 1, 0);

// Billboarded label offset toward the camera, just outside the anchor's silhouette,
// recomputed every frame so it never rotates into overlap as the camera orbits
// (plan.md decision #3 — applies to node, edge, and orbit/space titles alike).
export function RadialLabel({
  text,
  radius,
  color,
  fontSize,
  margin = 0.5,
  outlineOpacity = 0.5,
  fillOpacity = 1,
}: RadialLabelProps) {
  const anchorRef = useRef<THREE.Group>(null);
  const offsetRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!anchorRef.current || !offsetRef.current) return;
    anchorRef.current.getWorldPosition(tempWorldPos);
    tempDir.copy(camera.position).sub(tempWorldPos);
    if (tempDir.lengthSq() < 1e-6) tempDir.copy(FALLBACK_DIR);
    else tempDir.normalize();
    offsetRef.current.position.copy(tempDir).multiplyScalar(radius + margin);
  });

  return (
    <group ref={anchorRef}>
      <group ref={offsetRef}>
        <Billboard>
          <Text
            fontSize={fontSize}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="black"
            outlineOpacity={outlineOpacity}
            fillOpacity={fillOpacity}
          >
            {text}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}
