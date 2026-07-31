import { useModelStore } from "@/store/store";
import { InfoPanel } from "./InfoPanel";
import { TabBar } from "./TabBar";

export function BottomDock() {
  const hasOpenTabs = useModelStore((state) => state.openTabs.length > 0);
  if (!hasOpenTabs) return null;

  return (
    <div className="bg-card/95 border-border absolute inset-x-0 bottom-0 border-t backdrop-blur">
      <TabBar />
      <InfoPanel />
    </div>
  );
}
