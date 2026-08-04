import { Billboard, Line, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { getWorldPosition, relationshipScope, type RelationshipScope } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Cardinality, Relationship } from "@/store/types";
import { computeEdgeControlPoint, trimEdgeEndpoints } from "./edgeGeometry";
import { isRelationshipVisible } from "./edgeVisibility";
import { ENTITY_RADIUS } from "./EntityNode";
import { useViewStore } from "./viewStore";

const CURVE_SEGMENTS = 32;
const HIT_TUBE_RADIUS = 0.35;
const TRIM_RADIUS = ENTITY_RADIUS + 0.05;
const MARKER_T = 0.14;
const ARROW_LENGTH = 0.35;
const ARROW_RADIUS = 0.15;

// Exported so the InfoPanel can color a relationship's title the same as its rendered edge —
// relationships have no fixed per-type hue like space/orbit/entity do, their "color" is scope
// (local/cross-orbit/cross-space), so this is the one source of truth for it.
export const EDGE_STYLES: Record<
  RelationshipScope,
  { color: string; lineWidth: number; dashed: boolean }
> = {
  local: { color: "#94a3b8", lineWidth: 1.5, dashed: false },
  "cross-orbit": { color: "#f59e0b", lineWidth: 2, dashed: false },
  "cross-space": { color: "#ec4899", lineWidth: 2, dashed: true },
};

function splitCardinality(cardinality: Cardinality): [string, string] {
  const [source, target] = cardinality.split(":");
  return [source, target];
}

function toVector3(v: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

export function RelationshipEdge({ relationship }: { relationship: Relationship }) {
  const sourcePos = useModelStore(useShallow((state) => getWorldPosition(state, relationship.sourceId)));
  const targetPos = useModelStore(useShallow((state) => getWorldPosition(state, relationship.targetId)));
  const scope = useModelStore((state) => relationshipScope(state, relationship.id));
  const isActive = useModelStore((state) => state.activeTabId === relationship.id);
  const openTab = useModelStore((state) => state.openTab);
  const focusOn = useViewStore((state) => state.focusOn);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);
  const isVisible = useModelStore((state) =>
    isRelationshipVisible(state, relationship.id, hiddenSpaceIds, hiddenOrbitIds),
  );

  const { points, hitGeometry, sourceMarkerPos, targetMarkerPos, sourceArrow, targetArrow } =
    useMemo(() => {
      const control = computeEdgeControlPoint(sourcePos, targetPos);
      const trimmed = trimEdgeEndpoints(sourcePos, control, targetPos, TRIM_RADIUS);

      const curve = new THREE.QuadraticBezierCurve3(
        toVector3(trimmed.start),
        toVector3(control),
        toVector3(trimmed.end),
      );

      // Tangent at t=0 points from source toward target (forward); the arrow touching the
      // source node faces the opposite way (backward, out of the curve and into the node).
      const forwardAtSource = curve.getTangentAt(0);
      const forwardAtTarget = curve.getTangentAt(1);

      return {
        points: curve.getPoints(CURVE_SEGMENTS),
        hitGeometry: new THREE.TubeGeometry(curve, CURVE_SEGMENTS, HIT_TUBE_RADIUS, 6, false),
        sourceMarkerPos: curve.getPointAt(MARKER_T),
        targetMarkerPos: curve.getPointAt(1 - MARKER_T),
        sourceArrow: { tip: curve.getPointAt(0), direction: forwardAtSource.clone().negate() },
        targetArrow: { tip: curve.getPointAt(1), direction: forwardAtTarget },
      };
    }, [sourcePos, targetPos]);

  if (!isVisible) return null;

  const style = EDGE_STYLES[scope];
  const [sourceCardinality, targetCardinality] = splitCardinality(relationship.cardinality);

  // An entity mesh is always more specific than the edge tube passing near/through it
  // (e.g. any same-orbit edge's endpoints sit right at its connected entities) — defer to it.
  const hitEntity = (e: ThreeEvent<MouseEvent>) =>
    e.intersections.some((i) => i.object.userData?.entityId);

  // Single click only moves the camera (same as a sidebar row click); the panel only opens on
  // double-click, or via the sidebar's "View notes" context menu item.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitEntity(e)) return;
    e.stopPropagation();
    focusOn(relationship.id, "relationship");
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitEntity(e)) return;
    e.stopPropagation();
    openTab(relationship.id, "relationship");
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group>
      <Line
        points={points}
        color={style.color}
        lineWidth={isActive ? style.lineWidth + 1.5 : style.lineWidth}
        transparent
        opacity={isActive ? 1 : 0.8}
        dashed={style.dashed}
        dashSize={0.4}
        gapSize={0.25}
      />
      <mesh
        geometry={hitGeometry}
        userData={{ relationshipId: relationship.id }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <CardinalityMarker position={sourceMarkerPos} text={sourceCardinality} color={style.color} />
      <CardinalityMarker position={targetMarkerPos} text={targetCardinality} color={style.color} />
      {relationship.cardinality === "N:M" && (
        <>
          <ArrowHead tip={sourceArrow.tip} direction={sourceArrow.direction} color={style.color} />
          <ArrowHead tip={targetArrow.tip} direction={targetArrow.direction} color={style.color} />
        </>
      )}
    </group>
  );
}

// N:M is the one cardinality that's inherently bidirectional (many on both sides), so it's the
// only one that gets arrowheads — 1:1/1:N keep just the text cardinality markers, unchanged.
function ArrowHead({
  tip,
  direction,
  color,
}: {
  tip: THREE.Vector3;
  direction: THREE.Vector3;
  color: string;
}) {
  const { position, quaternion } = useMemo(() => {
    const dir = direction.clone().normalize();
    // ConeGeometry is centered on its local origin with the apex at +height/2 along +Y, so the
    // mesh position has to sit half a length back from the tip along the arrow's own direction.
    return {
      position: tip.clone().sub(dir.clone().multiplyScalar(ARROW_LENGTH / 2)),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    };
  }, [tip, direction]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[ARROW_RADIUS, ARROW_LENGTH, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function CardinalityMarker({
  position,
  text,
  color,
}: {
  position: THREE.Vector3;
  text: string;
  color: string;
}) {
  return (
    <Billboard position={position}>
      <Text
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="black"
        outlineOpacity={0.6}
      >
        {text}
      </Text>
    </Billboard>
  );
}
