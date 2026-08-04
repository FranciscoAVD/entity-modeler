import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Presentational — knows nothing about the store or which object type it's attached to;
// callers bind the right store action (updateSpaceTags/updateOrbitTags/updateEntityTags) into
// onUpdate. Existing tags render as removable chips; a small input appends new ones.
export function TagEditor({ tags, onUpdate }: { tags: string[]; onUpdate: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const trimmed = draft.trim();
    setDraft("");
    if (!trimmed || tags.includes(trimmed)) return;
    onUpdate([...tags, trimmed]);
  };

  const removeTag = (tag: string) => onUpdate(tags.filter((t) => t !== tag));

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Tags</h4>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" data-icon="inline-end" className="capitalize">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="transition-colors hover:text-destructive"
              >
                <X className="size-2.5!" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder="Add tag..."
        className={cn("h-6 w-full px-1.5 text-xs", tags.length > 0 && "mt-1")}
      />
    </div>
  );
}
