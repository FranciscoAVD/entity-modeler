import { useState } from "react";
import { objectsForTag } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// Wraps an updateXTags action (node/orbit/space/relationship — all four share this) so that
// removing a tag from an object, when that tag ends up attached to nothing else anywhere in the
// project, prompts to delete it from the registry outright rather than silently leaving an
// orphaned tag behind (still valid, still autocompletes, just pointing at nothing). One shared
// hook rather than duplicating the same diff-and-check logic at all four InfoPanel.tsx call sites.
export function useTagRemovalPrompt(projectId: string | undefined) {
  const [pendingTag, setPendingTag] = useState<{ id: string; name: string } | null>(null);
  const deleteTag = useModelStore((state) => state.deleteTag);

  // `currentTagIds` is the object's tagIds *before* this edit — needed to resolve which id(s) a
  // by-name diff against the new list actually removed, since TagEditor's onUpdate only ever
  // hands back names, never ids. Matches case-insensitively, same as resolveTagIds does on write.
  const withOrphanPrompt =
    (currentTagIds: string[], update: (tags: string[]) => void) => (names: string[]) => {
      const before = useModelStore.getState();
      const removedIds = currentTagIds.filter((id) => {
        const tag = before.tags.get(id);
        const stillPresent = tag && names.some((n) => n.trim().toLowerCase() === tag.name.toLowerCase());
        return !stillPresent;
      });

      update(names);

      if (!projectId || removedIds.length === 0) return;
      const after = useModelStore.getState();
      for (const id of removedIds) {
        const tag = after.tags.get(id);
        if (!tag) continue;
        if (objectsForTag(after, id).length === 0) {
          setPendingTag({ id, name: tag.name });
          return; // one prompt at a time, even if this single edit orphaned more than one tag
        }
      }
    };

  const dialog = (
    <DeleteConfirmDialog
      open={pendingTag !== null}
      onOpenChange={(open) => {
        if (!open) setPendingTag(null);
      }}
      title="Delete this tag?"
      description={`"${pendingTag?.name}" is no longer attached to anything in this project. Delete it from the tag list?`}
      onConfirm={() => {
        if (pendingTag) deleteTag(pendingTag.id);
      }}
    />
  );

  return { withOrphanPrompt, dialog };
}
