import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Generic "name + sensible defaults" dialog, shared by project/space/orbit/node creation and
// by space/orbit rename — relationships get their own dialog (AddRelationshipDialog) since
// they need two entity references rather than just a name.
export function CreateDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  initialValue = "",
  submitLabel = "Create",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  // This dialog instance is reused across different targets (create vs. rename, or one
  // rename after another) without unmounting, so `value` needs to be re-synced to whichever
  // initialValue the caller passes whenever the dialog opens — a plain useState initializer
  // only runs once, on mount.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const close = (next: boolean) => {
    onOpenChange(next);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
