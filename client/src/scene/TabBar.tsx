import { ArrowRightLeft, Circle, Orbit, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { tabLabel } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Tab } from "@/store/types";

const TAB_ICONS = {
  entity: Circle,
  orbit: Orbit,
  relationship: ArrowRightLeft,
} as const;

function TabChip({ tab, active }: { tab: Tab; active: boolean }) {
  const label = useModelStore((state) => tabLabel(state, tab));
  const setActiveTab = useModelStore((state) => state.setActiveTab);
  const closeTab = useModelStore((state) => state.closeTab);
  const Icon = TAB_ICONS[tab.type];

  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-t-md border-x border-t px-2.5 py-1.5 text-sm ${
        active
          ? "bg-card border-border text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <button type="button" className="flex items-center gap-1.5" onClick={() => setActiveTab(tab.id)}>
        <Icon className="size-3.5 shrink-0" />
        <span className="max-w-40 truncate">{label}</span>
      </button>
      <button
        type="button"
        aria-label={`Close ${label}`}
        className="hover:bg-muted rounded p-0.5"
        onClick={() => closeTab(tab.id)}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function TabBar() {
  const openTabs = useModelStore(useShallow((state) => state.openTabs));
  const activeTabId = useModelStore((state) => state.activeTabId);

  if (openTabs.length === 0) return null;

  return (
    <div className="border-border flex gap-1 overflow-x-auto border-b px-2 pt-2">
      {openTabs.map((tab) => (
        <TabChip key={tab.id} tab={tab} active={tab.id === activeTabId} />
      ))}
    </div>
  );
}
