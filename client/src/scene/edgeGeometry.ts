import { add, cross, length, normalize, scale, subtract } from "@/lib/vector3";
import type { Vector3 } from "@/store/types";

const CURVE_FACTOR = 0.2;
const UP: Vector3 = { x: 0, y: 1, z: 0 };
const FALLBACK_AXIS: Vector3 = { x: 1, y: 0, z: 0 };

// Offsets the midpoint perpendicular to start->end so edges read as curves rather than
// straight lines through node centers; proportional to length so short and long edges
// both get a visually consistent arc.
export function computeEdgeControlPoint(start: Vector3, end: Vector3): Vector3 {
  const direction = subtract(end, start);
  const distance = length(direction);
  if (distance < 1e-9) return start;

  let perpendicular = cross(direction, UP);
  if (length(perpendicular) < 1e-6) perpendicular = cross(direction, FALLBACK_AXIS);
  perpendicular = normalize(perpendicular);

  const mid = scale(add(start, end), 0.5);
  return add(mid, scale(perpendicular, distance * CURVE_FACTOR));
}

export interface TrimmedEdgeEndpoints {
  start: Vector3;
  end: Vector3;
}

// Pulls each endpoint back along its tangent toward the control point, by `radius`, so the
// curve (and its hit-tube) starts/ends at a node's surface instead of its center — otherwise a
// click near a node would also raycast-hit the edge's hit-tube inside the node's own sphere.
export function trimEdgeEndpoints(
  start: Vector3,
  control: Vector3,
  end: Vector3,
  radius: number,
): TrimmedEdgeEndpoints {
  const toControlFromStart = subtract(control, start);
  const toControlFromEnd = subtract(control, end);

  const startDistance = length(toControlFromStart);
  const endDistance = length(toControlFromEnd);

  return {
    start: startDistance > radius ? add(start, scale(normalize(toControlFromStart), radius)) : start,
    end: endDistance > radius ? add(end, scale(normalize(toControlFromEnd), radius)) : end,
  };
}
