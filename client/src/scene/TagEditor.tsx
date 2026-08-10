import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Presentational — knows nothing about the store or which object type it's attached to;
// callers bind the right store action (updateSpaceTags/updateOrbitTags/updateEntityTags) into
// onUpdate. Existing tags render as removable chips; a small input appends new ones.
//
// existingTags (the project's full tag-name list, plan.md decision #11's "planned but not
// built" autocomplete) drives a suggestion dropdown filtered by the current draft, so users
// converge on the shared vocabulary instead of relying on resolveTagIds' case-insensitive dedup
// to catch near-duplicates after the fact. Optional/defaulted since most callers eventually pass
// it, but nothing here strictly requires it.
export function TagEditor({
  tags,
  existingTags = [],
  onUpdate,
}: {
  tags: string[];
  existingTags?: string[];
  onUpdate: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const hasTag = (name: string) => tags.some((t) => t.toLowerCase() === name.toLowerCase());

  const addTag = (value?: string) => {
    const trimmed = (value ?? draft).trim();
    setDraft("");
    setShowSuggestions(false);
    if (!trimmed || hasTag(trimmed)) return;
    onUpdate([...tags, trimmed]);
  };

  const removeTag = (tag: string) => onUpdate(tags.filter((t) => t !== tag));

  const suggestions = draft.trim()
    ? existingTags
        .filter((name) => !hasTag(name) && name.toLowerCase().includes(draft.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">Tags</h4>
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
      <div className={cn("relative", tags.length > 0 && "mt-1")}>
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
            if (e.key === "Escape") setShowSuggestions(false);
          }}
          onBlur={() => addTag()}
          placeholder="Add tag..."
          className="h-7 w-full px-1.5 text-sm"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="bg-popover ring-foreground/10 absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-sm shadow-md ring-1">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                // Fires before the input's own onBlur (which would otherwise submit whatever's
                // still typed in the draft instead of the suggestion just clicked).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(name)}
                className="hover:bg-accent/10 block w-full px-2 py-1 text-left text-sm capitalize transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
