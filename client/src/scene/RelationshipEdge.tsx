import { Billboard, Line, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
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

const EDGE_STYLES: Record<RelationshipScope, { color: string; lineWidth: number; dashed: boolean }> = {
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
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);
  const isVisible = useModelStore((state) =>
    isRelationshipVisible(state, relationship.id, hiddenSpaceIds, hiddenOrbitIds),
  );
  const [hovered, setHovered] = useState(false);
  // Hover previews the same lineWidth/opacity boost as "active", same rationale as EntityNode.
  const highlighted = isActive || hovered;

  const { points, hitGeometry, sourceMarkerPos, targetMarkerPos } = useMemo(() => {
    const control = computeEdgeControlPoint(sourcePos, targetPos);
    const trimmed = trimEdgeEndpoints(sourcePos, control, targetPos, TRIM_RADIUS);

    const curve = new THREE.QuadraticBezierCurve3(
      toVector3(trimmed.start),
      toVector3(control),
      toVector3(trimmed.end),
    );

    return {
      points: curve.getPoints(CURVE_SEGMENTS),
      hitGeometry: new THREE.TubeGeometry(curve, CURVE_SEGMENTS, HIT_TUBE_RADIUS, 6, false),
      sourceMarkerPos: curve.getPointAt(MARKER_T),
      targetMarkerPos: curve.getPointAt(1 - MARKER_T),
    };
  }, [sourcePos, targetPos]);

  if (!isVisible) return null;

  const style = EDGE_STYLES[scope];
  const [sourceCardinality, targetCardinality] = splitCardinality(relationship.cardinality);

  // An entity mesh is always more specific than the edge tube passing near/through it
  // (e.g. any same-orbit edge's endpoints sit right at its connected entities) — defer to it.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const hitEntity = e.intersections.some((i) => i.object.userData?.entityId);
    if (hitEntity) return;
    e.stopPropagation();
    openTab(relationship.id, "relationship");
  };

  // Same deferral as the click handler above: an entity sitting on the edge's hit-tube
  // shouldn't also light up the edge while the mouse is really targeting the entity.
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = "pointer";
    const hitEntity = e.intersections.some((i) => i.object.userData?.entityId);
    if (hitEntity) return;
    e.stopPropagation();
    setHovered(true);
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
    setHovered(false);
  };

  return (
    <group>
      <Line
        points={points}
        color={style.color}
        lineWidth={highlighted ? style.lineWidth + 1.5 : style.lineWidth}
        transparent
        opacity={highlighted ? 1 : 0.8}
        dashed={style.dashed}
        dashSize={0.4}
        gapSize={0.25}
      />
      <mesh
        geometry={hitGeometry}
        userData={{ relationshipId: relationship.id }}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <CardinalityMarker position={sourceMarkerPos} text={sourceCardinality} color={style.color} />
      <CardinalityMarker position={targetMarkerPos} text={targetCardinality} color={style.color} />
    </group>
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
