import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/store";
import { InfoPanel } from "./InfoPanel";

export function SidePanel({ className }: { className?: string }) {
  const hasOpenTabs = useModelStore((state) => state.openTabs.length > 0);
  if (!hasOpenTabs) return null;

  return (
    <div
      className={cn(
        "bg-card/95 border-border flex flex-col border-l backdrop-blur",
        className,
      )}
    >
      <InfoPanel />
    </div>
  );
}
