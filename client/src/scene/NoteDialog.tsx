import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Note } from "@/store/types";
import { MetadataTable } from "./MetadataTable";

// Single dialog covering view, add, and edit — consolidates what used to be two separate dialogs
// (a view-only one opened by clicking a note, an edit-only one opened by its row's pencil button).
// "new" has nothing to view yet, so it opens straight into the edit form; an existing note opens
// read-only with a pencil toggle into that same form.
export function NoteDialog({
  open,
  onOpenChange,
  note,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: "new" | Note;
  onSubmit: (title: string, text: string) => void;
}) {
  const isNew = note === "new";
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // Reused-instance, resync-on-open — same pattern as CreateDialog. Always starts on the edit
  // form for "new", and back on the read-only view for an existing note, regardless of which
  // mode it was left in the last time it was open.
  useEffect(() => {
    if (open) {
      setEditing(isNew);
      setTitle(isNew ? "" : note.title);
      setText(isNew ? "" : note.text);
    }
  }, [open, isNew, note]);

  const close = (next: boolean) => {
    onOpenChange(next);
  };

  const canSubmit = title.trim() && text.trim();

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(title.trim(), text.trim());
    if (isNew) close(false);
    else setEditing(false);
  };

  // Cancelling a fresh note has nothing to fall back to, so it closes the dialog; cancelling an
  // edit on an existing note just returns to viewing it.
  const cancelEdit = () => {
    if (isNew) close(false);
    else setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {editing ? (
          <>
            <DialogHeader>
              <DialogTitle>{isNew ? "Add note" : "Edit note"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
              />
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Note text"
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {isNew ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          !isNew && (
            <>
              <DialogHeader>
                <DialogTitle className="text-primary">{note.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setEditing(true)}
                    aria-label="Edit note"
                  >
                    <Pencil />
                  </Button>
                </div>
                <p className="text-justify whitespace-pre-wrap break-words">{note.text}</p>
                {note.author && <p className="text-muted-foreground text-xs">— {note.author}</p>}
                {note.metadata && <MetadataTable metadata={note.metadata} />}
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
