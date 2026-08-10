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
import { searchAll, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { EntityIcon, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
import { TagObjectsDialog } from "./TagObjectsDialog";
import { isEntityVisible, isOrbitVisible, isSpaceVisible } from "./visibility";
import { useViewStore } from "./viewStore";

const RESULT_ICON_CLASS = "size-4 p-0.5 shrink-0 rounded-full";

function ResultIcon({ type }: { type: SearchResult["type"] }) {
  switch (type) {
    case "space":
      return <SpaceIcon className={RESULT_ICON_CLASS} />;
    case "orbit":
      return <OrbitIcon className={RESULT_ICON_CLASS} />;
    case "entity":
      return <EntityIcon className={RESULT_ICON_CLASS} />;
    case "tag":
      return <TagIcon className={RESULT_ICON_CLASS} />;
  }
}

function resultKey(result: SearchResult) {
  return `${result.type}:${result.id}`;
}

// Fixed section order (tags always first), each section only rendered when it has ≥1 match — a
// user-requested redesign replacing the old flat merged list (title + exact-tag matches
// interleaved) and TagBrowserDialog's standalone "Browse tags" entry point.
const SECTIONS: { type: SearchResult["type"]; label: string }[] = [
  { type: "tag", label: "Tags" },
  { type: "space", label: "Spaces" },
  { type: "orbit", label: "Orbits" },
  { type: "entity", label: "Entities" },
];

export function SidebarSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [openTag, setOpenTag] = useState<{ id: string; name: string } | null>(null);

  // searchAll builds fresh SearchResult objects on every call, so a reactive selector would
  // return a new array (and, unlike an array of existing store objects, new *elements* too —
  // useShallow's one-level comparison can't see past that) on every render, looping forever.
  // Subscribing to the raw Maps instead and recomputing via useMemo only when they (or the
  // query) actually change avoids that entirely.
  const spaces = useModelStore((state) => state.spaces);
  const orbits = useModelStore((state) => state.orbits);
  const entities = useModelStore((state) => state.entities);
  const tags = useModelStore((state) => state.tags);
  const focusOn = useViewStore((state) => state.focusOn);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchAll({ spaces, orbits, entities, tags }, query, projectId);
  }, [query, spaces, orbits, entities, tags, projectId]);

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: results.filter((r) => r.type === section.type),
      })).filter((section) => section.items.length > 0),
    [results],
  );

  // A hidden result has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case (still
  // clear the query so the dropdown closes, so the click doesn't feel unresponsive).
  const handleValueChange = (result: SearchResult | null) => {
    if (!result) return;
    if (result.type === "tag") {
      setOpenTag({ id: result.id, name: result.name });
      setQuery("");
      return;
    }
    const modelState = useModelStore.getState();
    const visible =
      result.type === "space"
        ? isSpaceVisible(hiddenSpaceIds, result.id)
        : result.type === "orbit"
          ? isOrbitVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds)
          : isEntityVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds);
    if (visible) focusOn(result.id, result.type);
    setQuery("");
  };

  return (
    <>
      {/* searchAll already does fuzzy title + fuzzy tag-name matching across categories, so the
          combobox's own filtering is disabled (`filter={null}`) and fed pre-filtered `items`
          instead. `value` is always reset to null after a pick — this is a jump-to-result search,
          not a persistent selection, so nothing should stay "selected" in the input. */}
      <Combobox<SearchResult>
        items={results}
        value={null}
        onValueChange={handleValueChange}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={(result) => result.name}
        isItemEqualToValue={(a, b) => resultKey(a) === resultKey(b)}
        filter={null}
        openOnInputClick={false}
      >
        <ComboboxInput
          placeholder="Search entities, orbits, spaces, tags…"
          showTrigger={false}
        />
        <ComboboxContent>
          <ComboboxEmpty>No results.</ComboboxEmpty>
          <ComboboxList>
            {sections.map((section) => (
              <ComboboxGroup key={section.type} items={section.items}>
                <ComboboxLabel>{section.label}</ComboboxLabel>
                <ComboboxCollection>
                  {(result: SearchResult) => (
                    <ComboboxItem key={resultKey(result)} value={result}>
                      <ResultIcon type={result.type} />
                      <span className="truncate">{result.name}</span>
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
