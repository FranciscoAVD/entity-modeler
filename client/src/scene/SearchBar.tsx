import { Circle, Orbit } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchAll, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";

const RESULT_ICONS: Partial<Record<SearchResult["type"], typeof Circle>> = {
  entity: Circle,
  orbit: Orbit,
};

// Only entity/orbit results are tab-able (spaces/projects aren't part of the tab-based reveal
// flow — plan.md: "Spaces: not part of the reveal flow"), so they're shown but not selectable.
function isSelectable(type: SearchResult["type"]): type is "entity" | "orbit" {
  return type === "entity" || type === "orbit";
}

export function SearchBar() {
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
  const openTab = useModelStore((state) => state.openTab);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchAll({ projects, spaces, orbits, entities }, query);
  }, [query, projects, spaces, orbits, entities]);

  const handleSelect = (result: SearchResult) => {
    if (!isSelectable(result.type)) return;
    openTab(result.id, result.type);
    setQuery("");
  };

  return (
    <div className="absolute top-4 left-1/2 w-72 -translate-x-1/2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search entities, orbits, tags…"
        className="bg-card/90 backdrop-blur"
      />
      {results.length > 0 && (
        <div className="bg-card/95 border-border mt-1 max-h-64 overflow-y-auto rounded-lg border p-1 text-sm backdrop-blur">
          {results.map((result) => {
            const Icon = RESULT_ICONS[result.type];
            const selectable = isSelectable(result.type);
            return (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                disabled={!selectable}
                onClick={() => handleSelect(result)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                  selectable ? "hover:bg-muted" : "text-muted-foreground cursor-default opacity-60"
                }`}
              >
                {Icon ? <Icon className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
                <span className="truncate">{result.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">{result.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
