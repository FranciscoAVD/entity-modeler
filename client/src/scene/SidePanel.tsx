import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/store";
import { InfoPanel } from "./InfoPanel";
import { useViewStore } from "./viewStore";

// Gated on activeTabId, not openTabs — closing the panel (clearActiveTab) deliberately
// leaves the recency history alone, so this can hide even while tabs are still open to
// pick back up from the Header's "Recently viewed" select.
export function SidePanel({ className }: { className?: string }) {
  const activeTabId = useModelStore((state) => state.activeTabId);
  const clearActiveTab = useModelStore((state) => state.clearActiveTab);
  const closeNote = useViewStore((state) => state.closeNote);
  if (activeTabId === null) return null;

  return (
    <div
      className={cn(
        "bg-card/95 border-border flex flex-col border-l backdrop-blur",
        className,
      )}
    >
      <div className="border-border flex justify-end border-b p-1.5">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            clearActiveTab();
            // NotePanel docks flush against SidePanel's left edge (Overlay.tsx) — closing the
            // info panel out from under it would otherwise leave it floating mid-screen.
            closeNote();
          }}
          aria-label="Close panel"
        >
          <X />
        </Button>
      </div>
      <InfoPanel />
    </div>
  );
}
