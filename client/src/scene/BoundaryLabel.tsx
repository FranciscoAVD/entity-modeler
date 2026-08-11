import { Billboard, Text } from "@react-three/drei";

interface BoundaryLabelProps {
  text: string;
  radius: number;
  color: string;
  dimmer?: boolean;
}

const LABEL_MARGIN = 0.6;

// Fixed at the top of the sphere (unlike RadialLabel's camera-tracking offset): a space/orbit
// is large enough to view from many angles, and a label sliding around it as the camera orbits
// reads as disorienting rather than helpful — small node labels don't have that problem.
export function BoundaryLabel({ text, radius, color, dimmer }: BoundaryLabelProps) {
  return (
    <Billboard position={[0, radius + LABEL_MARGIN, 0]}>
      <Text
        fontSize={dimmer ? 0.5 : 0.7}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="black"
        outlineOpacity={dimmer ? 0.3 : 0.5}
        fillOpacity={dimmer ? 0.75 : 1}
      >
        {text}
      </Text>
    </Billboard>
  );
}
