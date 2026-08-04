import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Presentational, same division of responsibility as TagEditor — callers bind the right store
// action (updateSpaceMetadata/updateOrbitMetadata/updateEntityMetadata) into onUpdate. Values are
// always written back as strings from the text input; a number only survives here if it was set
// programmatically (e.g. seed data) and never touched through this editor.
export function MetadataEditor({
  metadata,
  onUpdate,
}: {
  metadata?: Record<string, string | number>;
  onUpdate: (metadata: Record<string, string | number> | undefined) => void;
}) {
  const entries = Object.entries(metadata ?? {});
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");

  const removeKey = (k: string) => {
    const next = { ...metadata };
    delete next[k];
    onUpdate(Object.keys(next).length > 0 ? next : undefined);
  };

  const addEntry = () => {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) return;
    onUpdate({ ...metadata, [trimmedKey]: trimmedValue });
    setKey("");
    setValue("");
  };

  const startEdit = (k: string, v: string | number) => {
    setEditingKey(k);
    setEditKey(k);
    setEditValue(String(v));
  };

  const cancelEdit = () => setEditingKey(null);

  // Renaming a key means dropping the old one and adding the new — a metadata bag has no
  // meaningful key order to preserve, so this is fine even though the renamed entry moves to
  // the end.
  const saveEdit = () => {
    if (!editingKey) return;
    const trimmedKey = editKey.trim();
    const trimmedValue = editValue.trim();
    if (!trimmedKey || !trimmedValue) return;
    const next = { ...metadata };
    delete next[editingKey];
    next[trimmedKey] = trimmedValue;
    onUpdate(next);
    setEditingKey(null);
  };

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
        Metadata
      </h4>
      {/* Rows stay edge-to-edge (no padding on the table itself) so a row's hover background
          spans the full panel width, same pattern as NoteList — the cells carry pl-3/pr-3 instead
          so the key/value text and action buttons still line up with PanelSection's px-3 inset. */}
      {entries.length > 0 && (
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([k, v]) =>
              editingKey === k ? (
                <tr key={k}>
                  <td className="py-0.5 pr-1 pl-3">
                    <Input
                      autoFocus
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-6 px-1.5 font-mono text-xs"
                    />
                  </td>
                  <td className="py-0.5 pr-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-6 px-1.5 text-xs"
                    />
                  </td>
                  <td className="w-0 pr-3 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={saveEdit}
                      disabled={!editKey.trim() || !editValue.trim()}
                      aria-label="Save"
                    >
                      <Check />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={cancelEdit} aria-label="Cancel">
                      <X />
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={k} className="hover:bg-accent/10 transition-colors">
                  <td className="text-muted-foreground py-0.5 pr-3 pl-3 font-mono capitalize">
                    {k}
                  </td>
                  <td className="py-0.5 break-words">{v}</td>
                  <td className="w-0 pr-3 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEdit(k, v)}
                      aria-label={`Edit ${k}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeKey(k)}
                      aria-label={`Remove ${k}`}
                      className="hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
      <div className="flex items-center gap-1 px-3">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className="h-6 px-1.5 text-xs"
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="h-6 px-1.5 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") addEntry();
          }}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={addEntry}
          disabled={!key.trim() || !value.trim()}
          aria-label="Add metadata entry"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
