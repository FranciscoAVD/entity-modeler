import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { searchAll, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { TYPE_ICONS } from "./typeIcons";
import { EntityIcon, ENTITY_COLOR, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
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
    case "project": {
      const ProjectIcon = TYPE_ICONS.project;
      return <ProjectIcon color={ENTITY_COLOR} className={RESULT_ICON_CLASS} />;
    }
  }
}

// Projects have no scene geometry to fly to, so they're shown but not selectable here.
// Spaces/orbits/entities all resolve to a focusOn-able target — spaces aren't part of the
// tab-based reveal flow (plan.md: "Spaces: not part of the reveal flow"), but they're still
// focusable via the sidebar tree's focusOn, same as here.
function isSelectable(type: SearchResult["type"]): type is "entity" | "orbit" | "space" {
  return type === "entity" || type === "orbit" || type === "space";
}

function resultKey(result: SearchResult) {
  return `${result.type}:${result.id}`;
}

export function SidebarSearch() {
  const [query, setQuery] = useState("");

  // searchAll builds fresh SearchResult objects on every call, so a reactive selector would
  // return a new array (and, unlike an array of existing store objects, new *elements* too —
  // useShallow's one-level comparison can't see past that) on every render, looping forever.
  // Subscribing to the raw Maps instead and recomputing via useMemo only when they (or the
  // query) actually change avoids that entirely.
  const projects = useModelStore((state) => state.projects);
  const spaces = useModelStore((state) => state.spaces);
  const orbits = useModelStore((state) => state.orbits);
  const entities = useModelStore((state) => state.entities);
  const tags = useModelStore((state) => state.tags);
  const focusOn = useViewStore((state) => state.focusOn);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchAll({ projects, spaces, orbits, entities, tags }, query);
  }, [query, projects, spaces, orbits, entities, tags]);

  // A hidden result has no scene geometry to fly to — resolveCameraFocus refuses to focus it
  // and falls through to whichever tab is currently active instead, which reads as the camera
  // randomly jumping to an unrelated object. Don't even request the focus in that case (still
  // clear the query so the dropdown closes, so the click doesn't feel unresponsive).
  const handleValueChange = (result: SearchResult | null) => {
    if (!result || !isSelectable(result.type)) return;
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
    // searchAll already does fuzzy title + exact tag matching across types, so the combobox's
    // own filtering is disabled (`filter={null}`) and fed pre-filtered `items` instead.
    // `value` is always reset to null after a pick — this is a jump-to-result search, not a
    // persistent selection, so nothing should stay "selected" in the input.
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
          {(result: SearchResult) => {
            const selectable = isSelectable(result.type);
            return (
              <ComboboxItem
                key={resultKey(result)}
                value={result}
                disabled={!selectable}
                className={!selectable ? "text-muted-foreground" : undefined}
              >
                <ResultIcon type={result.type} />
                <span className="truncate">{result.name}</span>
                <span className="ml-auto text-sm capitalize">
                  {result.type}
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
