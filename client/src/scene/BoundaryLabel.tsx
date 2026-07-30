import { Billboard, Text } from "@react-three/drei";

interface BoundaryLabelProps {
  text: string;
  radius: number;
  color: string;
  dimmer?: boolean;
}

const LABEL_MARGIN = 0.6;

// Always-visible, camera-facing label offset just outside the boundary sphere (plan.md decision #3).
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
