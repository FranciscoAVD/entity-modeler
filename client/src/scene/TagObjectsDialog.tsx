import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { objectsForTag, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { isRelationshipVisible } from "./edgeVisibility";
import { NodeIcon, OrbitIcon, RelationshipIcon, SpaceIcon } from "./SidebarTypeIcons";
import { isNodeVisible, isOrbitVisible, isSpaceVisible } from "./visibility";
import { useViewStore } from "./viewStore";

const OBJECT_ICON_CLASS = "size-4 p-0.5 shrink-0 rounded-full";

function ObjectIcon({ type }: { type: SearchResult["type"] }) {
  switch (type) {
    case "space":
      return <SpaceIcon className={OBJECT_ICON_CLASS} />;
    case "orbit":
      return <OrbitIcon className={OBJECT_ICON_CLASS} />;
    case "node":
      return <NodeIcon className={OBJECT_ICON_CLASS} />;
    case "relationship":
      return <RelationshipIcon className={OBJECT_ICON_CLASS} />;
    case "tag":
      return null;
  }
}

// Opened by clicking a Tag result in SidebarSearch — read-only (no rename/delete; that was
// TagBrowserDialog's job, retired in favor of folding tag search into the main search box).
// Clicking an object row opens it (openTab) rather than just focusing the camera — unlike a
// plain sidebar-row/search-result click, picking something out of "what does this tag apply to"
// reads more like deliberately choosing to inspect that object, so the info panel opens too, same
// as a double-click in the 3D scene. Visibility is gated the same cascading way SidebarTree's own
// inline check should be but isn't (its OrbitRow only looks at the orbit's own hidden flag, not
// its parent space's) — deliberately using the more-correct cascading version here.
export function TagObjectsDialog({
  tag,
  onOpenChange,
}: {
  tag: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const spaces = useModelStore((state) => state.spaces);
  const orbits = useModelStore((state) => state.orbits);
  const nodes = useModelStore((state) => state.nodes);
  const relationships = useModelStore((state) => state.relationships);
  const openTab = useModelStore((state) => state.openTab);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);

  // objectsForTag builds fresh result objects every call — computed here as a plain useMemo over
  // the raw (stable) Maps rather than as a Zustand selector, so there's no getSnapshot-instability
  // risk (see the fix in TagBrowserDialog's history for the same class of bug via tagsInProject).
  const objects = useMemo(
    () => (tag ? objectsForTag({ spaces, orbits, nodes, relationships }, tag.id) : []),
    [tag, spaces, orbits, nodes, relationships],
  );

  const selectObject = (result: SearchResult) => {
    if (result.type === "tag") return;
    const modelState = useModelStore.getState();
    const visible =
      result.type === "space"
        ? isSpaceVisible(hiddenSpaceIds, result.id)
        : result.type === "orbit"
          ? isOrbitVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds)
          : result.type === "relationship"
            ? isRelationshipVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds)
            : isNodeVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds);
    if (!visible) return;
    openTab(result.id, result.type);
    onOpenChange(false);
  };

  return (
    <Dialog open={tag !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{tag?.name}</DialogTitle>
        </DialogHeader>
        {objects.length === 0 ? (
          <p className="text-muted-foreground text-base">Nothing tagged.</p>
        ) : (
          <div className="-mx-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4">
            {objects.map((result) => (
              <div
                key={`${result.type}:${result.id}`}
                className="hover:bg-accent/10 flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-1 transition-colors"
                onClick={() => selectObject(result)}
              >
                <ObjectIcon type={result.type} />
                <span className="truncate text-sm">{result.name}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
