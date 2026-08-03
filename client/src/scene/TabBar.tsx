import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tabLabel } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Tab } from "@/store/types";
import { TYPE_ICONS } from "./typeIcons";

function TabOption({ tab }: { tab: Tab }) {
  const label = useModelStore((state) => tabLabel(state, tab));
  const Icon = TYPE_ICONS[tab.type];

  return (
    <SelectItem value={tab.id}>
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    </SelectItem>
  );
}

// A row of removable chips (one per open tab) got cluttered fast with more than a couple
// objects open at once. openTabs is now a recency-capped history (store.ts's openTab keeps
// only the 5 most recently viewed) rather than a user-managed open/close list, so a single
// Select — newest first — replaces the chip row entirely; there's nothing left to "close".
export function TabBar() {
  const openTabs = useModelStore((state) => state.openTabs);
  const activeTabId = useModelStore((state) => state.activeTabId);
  const setActiveTab = useModelStore((state) => state.setActiveTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="border-border border-b p-2">
      <Select value={activeTabId ?? undefined} onValueChange={setActiveTab}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Recently viewed" />
        </SelectTrigger>
        <SelectContent>
          {[...openTabs].reverse().map((tab) => (
            <TabOption key={tab.id} tab={tab} />
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
