import { Tag as TagIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { searchAll, tabLabel, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Tab } from "@/store/types";
import { NodeIcon, OrbitIcon, RelationshipIcon, SpaceIcon } from "./SidebarTypeIcons";
import { TagObjectsDialog } from "./TagObjectsDialog";
import { isNodeVisible, isOrbitVisible, isSpaceVisible } from "./visibility";
import { useViewStore } from "./viewStore";

const RESULT_ICON_CLASS = "size-4 p-0.5 shrink-0 rounded-full";

// A recently-viewed entry — shown instead of search results when the input is focused with an
// empty query. Replaces the Header's old standalone "Recently viewed" dropdown (TabBar.tsx,
// removed), surfacing the same openTabs history from the search box instead. Extends Tab rather
// than duplicating id/type, plus a precomputed label (tabLabel needs the model store to resolve
// it, which a plain SearchResult's `name` field doesn't require).
interface RecentItem extends Tab {
  kind: "recent";
  label: string;
}

type ComboboxValue = SearchResult | RecentItem;

function isRecentItem(item: ComboboxValue): item is RecentItem {
  return "kind" in item && item.kind === "recent";
}

function itemKey(item: ComboboxValue): string {
  return isRecentItem(item) ? `recent:${item.type}:${item.id}` : `${item.type}:${item.id}`;
}

function itemLabel(item: ComboboxValue): string {
  return isRecentItem(item) ? item.label : item.name;
}

function ResultIcon({ type }: { type: SearchResult["type"] | Tab["type"] }) {
  switch (type) {
    case "space":
      return <SpaceIcon className={RESULT_ICON_CLASS} />;
    case "orbit":
      return <OrbitIcon className={RESULT_ICON_CLASS} />;
    case "node":
      return <NodeIcon className={RESULT_ICON_CLASS} />;
    case "relationship":
      return <RelationshipIcon className={RESULT_ICON_CLASS} />;
    case "tag":
      return <TagIcon className={RESULT_ICON_CLASS} />;
  }
}

// Fixed section order (tags always first), each section only rendered when it has ≥1 match — a
// user-requested redesign replacing the old flat merged list (title + exact-tag matches
// interleaved) and TagBrowserDialog's standalone "Browse tags" entry point.
const SECTIONS: { type: SearchResult["type"]; label: string }[] = [
  { type: "tag", label: "Tags" },
  { type: "space", label: "Spaces" },
  { type: "orbit", label: "Orbits" },
  { type: "node", label: "Nodes" },
];

export function SidebarSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [openTag, setOpenTag] = useState<{ id: string; name: string } | null>(null);

  // searchAll builds fresh SearchResult objects on every call, so a reactive selector would
  // return a new array (and, unlike an array of existing store objects, new *elements* too —
  // useShallow's one-level comparison can't see past that) on every render, looping forever.
  // Subscribing to the raw Maps instead and recomputing via useMemo only when they (or the
  // query) actually change avoids that entirely.
  const spaces = useModelStore((state) => state.spaces);
  const orbits = useModelStore((state) => state.orbits);
  const nodes = useModelStore((state) => state.nodes);
  const relationships = useModelStore((state) => state.relationships);
  const tags = useModelStore((state) => state.tags);
  const openTabs = useModelStore((state) => state.openTabs);
  const setActiveTab = useModelStore((state) => state.setActiveTab);
  const focusOn = useViewStore((state) => state.focusOn);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchAll({ spaces, orbits, nodes, tags }, query, projectId);
  }, [query, spaces, orbits, nodes, tags, projectId]);

  // Newest first, same order the old Header TabBar showed them in.
  const recentItems = useMemo<RecentItem[]>(() => {
    const state = { spaces, orbits, nodes, relationships };
    return [...openTabs].reverse().map((tab) => ({ ...tab, kind: "recent" as const, label: tabLabel(state, tab) }));
  }, [openTabs, spaces, orbits, nodes, relationships]);

  const sections = useMemo(() => {
    if (!query.trim()) {
      return recentItems.length
        ? [{ key: "recent", label: "Recently viewed", items: recentItems as ComboboxValue[] }]
        : [];
    }
    return SECTIONS.map((section) => ({
      key: section.type,
      label: section.label,
      items: results.filter((r) => r.type === section.type) as ComboboxValue[],
    })).filter((section) => section.items.length > 0);
  }, [query, recentItems, results]);

  // A hidden result has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case (still
  // clear the query so the dropdown closes, so the click doesn't feel unresponsive).
  const handleValueChange = (item: ComboboxValue | null) => {
    if (!item) return;
    if (isRecentItem(item)) {
      // Same behavior the old Header dropdown had: fly the camera AND open the side panel
      // (decision #12), unlike every other search result below, which is camera-only.
      setActiveTab(item.id);
      setQuery("");
      return;
    }
    if (item.type === "tag") {
      setOpenTag({ id: item.id, name: item.name });
      setQuery("");
      return;
    }
    const modelState = useModelStore.getState();
    const visible =
      item.type === "space"
        ? isSpaceVisible(hiddenSpaceIds, item.id)
        : item.type === "orbit"
          ? isOrbitVisible(modelState, item.id, hiddenSpaceIds, hiddenOrbitIds)
          : isNodeVisible(modelState, item.id, hiddenSpaceIds, hiddenOrbitIds);
    if (visible) focusOn(item.id, item.type);
    setQuery("");
  };

  return (
    <>
      {/* searchAll already does fuzzy title + fuzzy tag-name matching across categories, so the
          combobox's own filtering is disabled (`filter={null}`) and fed pre-filtered `items`
          instead. `value` is always reset to null after a pick — this is a jump-to-result search,
          not a persistent selection, so nothing should stay "selected" in the input. `open` is
          controlled so focusing the (empty) input can force it open to show recently-viewed —
          uncontrolled base-ui defaults wouldn't open on an empty query at all. */}
      <Combobox<ComboboxValue>
        items={query.trim() ? results : recentItems}
        value={null}
        onValueChange={handleValueChange}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={itemLabel}
        isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
        filter={null}
        open={open}
        onOpenChange={setOpen}
      >
        <ComboboxInput
          placeholder="Search nodes, orbits, spaces, tags…"
          showTrigger={false}
          onFocus={() => setOpen(true)}
        />
        <ComboboxContent>
          <ComboboxEmpty>{query.trim() ? "No results." : "Nothing viewed yet."}</ComboboxEmpty>
          <ComboboxList>
            {sections.map((section) => (
              <ComboboxGroup key={section.key} items={section.items}>
                <ComboboxLabel>{section.label}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: ComboboxValue) => (
                    <ComboboxItem key={itemKey(item)} value={item}>
                      <ResultIcon type={item.type} />
                      <span className="truncate">{itemLabel(item)}</span>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <TagObjectsDialog
        tag={openTag}
        onOpenChange={(open) => {
          if (!open) setOpenTag(null);
        }}
      />
    </>
  );
}
