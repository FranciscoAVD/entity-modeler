import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModelStore } from "@/store/store";
import type { Note } from "@/store/types";
import { FieldsTable, MetadataTable, NoteList } from "./InfoPanel";

export type NotesTarget = { type: "space" | "orbit" | "entity"; id: string } | null;

function NotesOrEmpty({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="text-muted-foreground text-sm">No notes yet.</p>;
  return <NoteList notes={notes} />;
}

// Spaces aren't part of the tab/InfoPanel reveal flow (plan.md: "Spaces: not part of the
// reveal flow"), and sidebar clicks never open tabs for orbits/entities either (only a direct
// scene click does) — so none of the three have anywhere else to show notes from the sidebar.
// This dialog gives all of them a shared, tab-independent way to view notes from the sidebar's
// context menu, reusing InfoPanel's field/note/metadata rendering rather than duplicating it.
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
  const entity = useModelStore((state) =>
    target?.type === "entity" ? state.entities.get(target.id) : undefined,
  );

  const group = target?.type === "space" ? space : target?.type === "orbit" ? orbit : undefined;

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group?.label ?? group?.name ?? entity?.name ?? "Notes"}
          </DialogTitle>
        </DialogHeader>
        {group && (
          <div className="space-y-3">
            {group.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {group.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {group.metadata && <MetadataTable metadata={group.metadata} />}
            <NotesOrEmpty notes={group.notes} />
          </div>
        )}
        {entity && (
          <div className="space-y-3">
            <FieldsTable fields={entity.fields} />
            <NotesOrEmpty notes={entity.notes} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
