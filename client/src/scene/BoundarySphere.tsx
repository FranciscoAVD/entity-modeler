import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface BoundarySphereProps {
  radius: number;
  color: string;
  empty: boolean;
}

// Populated groups get a tinted, solid-edged fill; empty groups drop the fill and
// switch to a dashed edge, per plan.md's empty-state treatment.
export function BoundarySphere({ radius, color, empty }: BoundarySphereProps) {
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(radius, 24, 16), [radius]);
  const wireframeGeometry = useMemo(
    () => new THREE.WireframeGeometry(sphereGeometry),
    [sphereGeometry],
  );
  const lineRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    if (empty) lineRef.current?.computeLineDistances();
  }, [wireframeGeometry, empty]);

  return (
    <group>
      {!empty && (
        <mesh geometry={sphereGeometry}>
          <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
      <lineSegments ref={lineRef} geometry={wireframeGeometry}>
        {empty ? (
          <lineDashedMaterial color={color} transparent opacity={0.5} dashSize={0.3} gapSize={0.25} />
        ) : (
          <lineBasicMaterial color={color} transparent opacity={0.35} />
        )}
      </lineSegments>
    </group>
  );
}
