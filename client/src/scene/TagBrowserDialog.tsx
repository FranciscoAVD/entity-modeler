import { Check, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { objectsForTag, tagsInProject, type SearchResult } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { EntityIcon, OrbitIcon, SpaceIcon } from "./SidebarTypeIcons";
import { isEntityVisible, isOrbitVisible, isSpaceVisible } from "./visibility";
import { useViewStore } from "./viewStore";

const OBJECT_ICON_CLASS = "size-4 p-0.5 shrink-0 rounded-full";

// objectsForTag never returns a "project" result (see its own comment), but SearchResult's type
// union still includes it — this covers that branch for exhaustiveness rather than assuming it
// away.
function ObjectIcon({ type }: { type: SearchResult["type"] }) {
  switch (type) {
    case "space":
      return <SpaceIcon className={OBJECT_ICON_CLASS} />;
    case "orbit":
      return <OrbitIcon className={OBJECT_ICON_CLASS} />;
    case "entity":
      return <EntityIcon className={OBJECT_ICON_CLASS} />;
    case "project":
      return null;
  }
}

// The tag registry UI (plan.md decision #11's other "planned but not built" item, alongside
// TagEditor's autocomplete): browse every tag in the current project, see what it's attached to,
// rename or delete it. Reachable from a "Tags" entry in Sidebar.tsx.
export function TagBrowserDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const tags = useModelStore((state) => tagsInProject(state, projectId));
  const spaces = useModelStore((state) => state.spaces);
  const orbits = useModelStore((state) => state.orbits);
  const entities = useModelStore((state) => state.entities);
  const renameTag = useModelStore((state) => state.renameTag);
  const deleteTag = useModelStore((state) => state.deleteTag);
  const focusOn = useViewStore((state) => state.focusOn);
  const hiddenSpaceIds = useViewStore((state) => state.hiddenSpaceIds);
  const hiddenOrbitIds = useViewStore((state) => state.hiddenOrbitIds);

  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  const startEdit = (tagId: string, name: string) => {
    setEditingTagId(tagId);
    setEditName(name);
    setRenameError(null);
  };

  const cancelEdit = () => {
    setEditingTagId(null);
    setRenameError(null);
  };

  const saveEdit = () => {
    if (!editingTagId) return;
    try {
      renameTag(editingTagId, editName);
      setEditingTagId(null);
      setRenameError(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Could not rename tag");
    }
  };

  // Same visibility gate as SidebarSearch's result click — a hidden object has no scene geometry
  // to fly to, so resolveCameraFocus would just fall through to whatever tab is already active.
  const selectObject = (result: SearchResult) => {
    if (result.type === "project") return;
    const modelState = useModelStore.getState();
    const visible =
      result.type === "space"
        ? isSpaceVisible(hiddenSpaceIds, result.id)
        : result.type === "orbit"
          ? isOrbitVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds)
          : isEntityVisible(modelState, result.id, hiddenSpaceIds, hiddenOrbitIds);
    if (!visible) return;
    focusOn(result.id, result.type);
    onOpenChange(false);
  };

  const deletingTag = tags.find((t) => t.id === deleteTagId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[70vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
          </DialogHeader>
          {tags.length === 0 ? (
            <p className="text-muted-foreground text-base">
              No tags yet — tag a space, orbit, or entity to get started.
            </p>
          ) : (
            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
              {tags.map((tag) => {
                const objects = objectsForTag({ spaces, orbits, entities }, tag.id);
                const expanded = expandedTagId === tag.id;
                const editing = editingTagId === tag.id;

                return (
                  <div key={tag.id} className="border-border border-b py-1.5 last:border-b-0">
                    {editing ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="h-7 px-1.5 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={saveEdit}
                            disabled={!editName.trim()}
                            aria-label="Save tag name"
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={cancelEdit}
                            aria-label="Cancel"
                          >
                            <X />
                          </Button>
                        </div>
                        {renameError && <p className="text-destructive text-sm">{renameError}</p>}
                      </div>
                    ) : (
                      <div
                        className="hover:bg-accent/10 -mx-1 flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors"
                        onClick={() => setExpandedTagId(expanded ? null : tag.id)}
                      >
                        <ChevronRight
                          className={cn(
                            "text-muted-foreground size-4 shrink-0 transition-transform",
                            expanded && "rotate-90",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate capitalize">{tag.name}</span>
                        <Badge variant="secondary">{objects.length}</Badge>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(tag.id, tag.name);
                          }}
                          aria-label={`Rename tag ${tag.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTagId(tag.id);
                          }}
                          aria-label={`Delete tag ${tag.name}`}
                          className="hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                    {expanded && !editing && (
                      <div className="mt-1 ml-5 space-y-0.5">
                        {objects.length === 0 ? (
                          <p className="text-muted-foreground text-sm">Nothing tagged.</p>
                        ) : (
                          objects.map((result) => (
                            <div
                              key={`${result.type}:${result.id}`}
                              className="hover:bg-accent/10 flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors"
                              onClick={() => selectObject(result)}
                            >
                              <ObjectIcon type={result.type} />
                              <span className="truncate text-sm">{result.name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={deleteTagId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTagId(null);
        }}
        title="Delete this tag?"
        description={`"${deletingTag?.name}" will be removed from every space, orbit, and entity that carries it. This can't be undone.`}
        onConfirm={() => deleteTagId && deleteTag(deleteTagId)}
      />
    </>
  );
}
