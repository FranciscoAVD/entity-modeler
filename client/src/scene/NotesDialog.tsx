import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModelStore } from "@/store/store";
import { MetadataTable, NoteList } from "./InfoPanel";

export type NotesTarget = { type: "space" | "orbit"; id: string } | null;

// Spaces aren't part of the tab/InfoPanel reveal flow (plan.md: "Spaces: not part of the
// reveal flow"), so their notes have nowhere to render otherwise. This dialog gives both
// spaces and orbits a shared, tab-independent way to view notes from the sidebar's context
// menu, reusing InfoPanel's note/metadata rendering rather than duplicating it.
export function NotesDialog({
  target,
  onOpenChange,
}: {
  target: NotesTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const space = useModelStore((state) =>
    target?.type === "space" ? state.spaces.get(target.id) : undefined,
  );
  const orbit = useModelStore((state) =>
    target?.type === "orbit" ? state.orbits.get(target.id) : undefined,
  );
  const record = target?.type === "space" ? space : orbit;

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record?.label ?? record?.name ?? "Notes"}</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="space-y-3">
            {record.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {record.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {record.metadata && <MetadataTable metadata={record.metadata} />}
            {record.notes.length > 0 ? (
              <NoteList notes={record.notes} />
            ) : (
              <p className="text-muted-foreground text-sm">No notes yet.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
