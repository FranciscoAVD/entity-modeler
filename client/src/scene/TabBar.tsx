import { X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { tabLabel } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Tab } from "@/store/types";
import { TYPE_ICONS } from "./typeIcons";

function TabChip({ tab, active }: { tab: Tab; active: boolean }) {
  const label = useModelStore((state) => tabLabel(state, tab));
  const setActiveTab = useModelStore((state) => state.setActiveTab);
  const closeTab = useModelStore((state) => state.closeTab);
  const Icon = TYPE_ICONS[tab.type];

  return (
    <div
      className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${
        active
          ? "bg-secondary border-border text-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-w-0 gap-1.5 p-0 hover:bg-transparent"
        onClick={() => setActiveTab(tab.id)}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="max-w-32 truncate">{label}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Close ${label}`}
        className="size-auto shrink-0 rounded-full p-0.5"
        onClick={() => closeTab(tab.id)}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}

export function TabBar() {
  const openTabs = useModelStore(useShallow((state) => state.openTabs));
  const activeTabId = useModelStore((state) => state.activeTabId);

  if (openTabs.length === 0) return null;

  return (
    <div className="border-border flex flex-wrap gap-1.5 border-b p-2">
      {openTabs.map((tab) => (
        <TabChip key={tab.id} tab={tab} active={tab.id === activeTabId} />
      ))}
    </div>
  );
}
