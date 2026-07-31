import { useModelStore } from "@/store/store";
import { InfoPanel } from "./InfoPanel";
import { TabBar } from "./TabBar";

export function SidePanel() {
  const hasOpenTabs = useModelStore((state) => state.openTabs.length > 0);
  if (!hasOpenTabs) return null;

  return (
    <div className="bg-card/95 border-border absolute top-16 right-0 bottom-0 flex w-80 flex-col border-l backdrop-blur">
      <TabBar />
      <InfoPanel />
    </div>
  );
}
