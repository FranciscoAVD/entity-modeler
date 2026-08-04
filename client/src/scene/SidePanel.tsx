import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/store";
import { InfoPanel } from "./InfoPanel";

// Gated on activeTabId, not openTabs — closing the panel (clearActiveTab) deliberately
// leaves the recency history alone, so this can hide even while tabs are still open to
// pick back up from the Header's "Recently viewed" select.
export function SidePanel({ className }: { className?: string }) {
  const activeTabId = useModelStore((state) => state.activeTabId);
  const clearActiveTab = useModelStore((state) => state.clearActiveTab);
  if (activeTabId === null) return null;

  return (
    <div
      className={cn(
        "bg-card/95 border-border flex flex-col border-l backdrop-blur",
        className,
      )}
    >
      <div className="border-border flex justify-end border-b p-1.5">
        <Button variant="ghost" size="icon-xs" onClick={clearActiveTab} aria-label="Close panel">
          <X />
        </Button>
      </div>
      <InfoPanel />
    </div>
  );
}
