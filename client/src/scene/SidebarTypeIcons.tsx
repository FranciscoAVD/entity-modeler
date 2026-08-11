import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "./typeIcons";

// Distinct hues per nesting level so containment is obvious at a glance (plan.md decision #13).
export const SPACE_COLOR = "#3b82f6"; // blue
export const ORBIT_COLOR = "#a855f7"; // violet
export const NODE_COLOR = "#10b981"; // teal — reserved for Phase 3 node rendering

interface SidebarTypeIconProps {
  className?: string;
}

export function SpaceIcon({ className }: SidebarTypeIconProps) {
  const Icon = TYPE_ICONS.space;
  return (
    <Icon
      color={SPACE_COLOR}
      className={cn("size-6 p-1 rounded-full", "bg-space/10", className)}
    />
  );
}

export function OrbitIcon({ className }: SidebarTypeIconProps) {
  const Icon = TYPE_ICONS.orbit;
  return (
    <Icon
      color={ORBIT_COLOR}
      className={cn("size-6 p-1 rounded-full", "bg-orbit/10", className)}
    />
  );
}

export function NodeIcon({ className }: SidebarTypeIconProps) {
  const Icon = TYPE_ICONS.node;
  return (
    <Icon
      color={NODE_COLOR}
      className={cn("size-6 p-1 rounded-full", "bg-node/10", className)}
    />
  );
}

// Relationships have no fixed per-type hue anywhere else in the app (their title/edge color
// depends on scope — local/cross-orbit/cross-space — not a signature color like Space/Orbit/
// Node have), so this stays a neutral/muted badge rather than inventing one just for this list.
export function RelationshipIcon({ className }: SidebarTypeIconProps) {
  const Icon = TYPE_ICONS.relationship;
  return (
    <Icon className={cn("size-6 p-1 rounded-full text-muted-foreground", "bg-muted/40", className)} />
  );
}
