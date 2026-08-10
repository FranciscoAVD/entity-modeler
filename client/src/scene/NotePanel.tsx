import { Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/store";
import { MarkdownContent } from "./MarkdownContent";
import { MetadataTable } from "./MetadataTable";
import { useViewStore } from "./viewStore";

// Docked sibling of SidePanel (see Overlay.tsx), not a modal — notes run long (500-800 words) and
// the shared Dialog primitive every other action uses is a fixed 384px with no height cap.
// Retires NoteDialog.tsx; "which note is open" now lives in viewStore (openNote/openNoteFor/
// closeNote) instead of NoteList's local state.
export function NotePanel({ className }: { className?: string }) {
  const openNote = useViewStore((state) => state.openNote);
  const closeNote = useViewStore((state) => state.closeNote);
  const addNote = useModelStore((state) => state.addNote);
  const updateNote = useModelStore((state) => state.updateNote);

  const isNew = openNote?.note === "new";
  const [editing, setEditing] = useState(isNew);
  // Write/Preview toggle, only relevant while editing — one pane at a time rather than a
  // side-by-side split, which would be cramped even at this panel's 28rem width.
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // Resync on whichever note becomes open — always starts on the edit form for "new", back on
  // the read-only view for an existing note, regardless of how the panel was last left.
  useEffect(() => {
    if (!openNote) return;
    setEditing(openNote.note === "new");
    setMode("write");
    setTitle(openNote.note === "new" ? "" : openNote.note.title);
    setText(openNote.note === "new" ? "" : openNote.note.text);
  }, [openNote]);

  if (!openNote) return null;
  const note = openNote.note;
  const canSubmit = title.trim() && text.trim();

  const submit = () => {
    if (!canSubmit) return;
    if (note === "new") {
      addNote(openNote.targetType, openNote.targetId, { title: title.trim(), text: text.trim() });
      closeNote();
    } else {
      updateNote(openNote.targetType, openNote.targetId, note.id, {
        title: title.trim(),
        text: text.trim(),
      });
      setEditing(false);
    }
  };

  // Cancelling a fresh note has nothing to fall back to, so it closes the panel; cancelling an
  // edit on an existing note just returns to viewing it.
  const cancelEdit = () => {
    if (note === "new") closeNote();
    else setEditing(false);
  };

  return (
    <div
      className={cn("bg-card/95 border-border flex flex-col border-l backdrop-blur", className)}
    >
      <div className="border-border flex items-center justify-between border-b py-1.5 pl-3 pr-1.5">
        <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {isNew ? "New note" : "Note"}
        </h4>
        <Button variant="ghost" size="icon-xs" onClick={closeNote} aria-label="Close note">
          <X />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {editing ? (
          <>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
            <div className="flex gap-1">
              <Button
                variant={mode === "write" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setMode("write")}
              >
                Write
              </Button>
              <Button
                variant={mode === "preview" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setMode("preview")}
              >
                Preview
              </Button>
            </div>
            {mode === "write" ? (
              <Textarea
                className="min-h-48 flex-1 resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Note text (Markdown supported)"
              />
            ) : (
              <div className="border-input min-h-48 flex-1 overflow-y-auto rounded-sm border px-2.5 py-2">
                {text.trim() ? (
                  <MarkdownContent text={text} />
                ) : (
                  <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {isNew ? "Add" : "Save"}
              </Button>
            </div>
          </>
        ) : (
          note !== "new" && (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-primary min-w-0 truncate text-xl font-semibold">
                  {note.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setEditing(true)}
                  aria-label="Edit note"
                >
                  <Pencil />
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {new Date(note.createdAt).toLocaleDateString()}
                {note.author && ` — ${note.author}`}
              </p>
              <MarkdownContent text={note.text} />
              {note.metadata && <MetadataTable metadata={note.metadata} />}
            </>
          )
        )}
      </div>
    </div>
  );
}
