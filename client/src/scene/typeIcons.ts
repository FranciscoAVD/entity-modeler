import { ArrowRightLeft, Box, Circle, Folder, Orbit } from "lucide-react";

// One icon per object type, shared across tab chips, search results, and sidebar tree actions
// so the same shape always means the same kind of thing.
export const TYPE_ICONS = {
  project: Folder,
  space: Box,
  orbit: Orbit,
  node: Circle,
  relationship: ArrowRightLeft,
} as const;
