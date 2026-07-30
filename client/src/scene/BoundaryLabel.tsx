import { RadialLabel } from "./RadialLabel";

interface BoundaryLabelProps {
  text: string;
  radius: number;
  color: string;
  dimmer?: boolean;
}

export function BoundaryLabel({ text, radius, color, dimmer }: BoundaryLabelProps) {
  return (
    <RadialLabel
      text={text}
      radius={radius}
      color={color}
      fontSize={dimmer ? 0.5 : 0.7}
      margin={0.6}
      outlineOpacity={dimmer ? 0.3 : 0.5}
      fillOpacity={dimmer ? 0.75 : 1}
    />
  );
}
