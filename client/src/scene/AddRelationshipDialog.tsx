import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { entitiesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Cardinality } from "@/store/types";

const SELECT_CLASS = "border-border bg-background w-full rounded border px-1.5 py-1 text-sm";

// Unlike space/orbit/node quick-add, a relationship has no meaningful "just a name" default —
// it needs two real entities to connect, so this gets its own dialog instead of CreateDialog.
export function AddRelationshipDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const entities = useModelStore(useShallow((state) => entitiesInProject(state, projectId)));
  const addRelationship = useModelStore((state) => state.addRelationship);

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [cardinality, setCardinality] = useState<Cardinality>("1:N");

  const close = (next: boolean) => {
    setSourceId("");
    setTargetId("");
    setCardinality("1:N");
    onOpenChange(next);
  };

  const canSubmit = sourceId && targetId && sourceId !== targetId;

  const submit = () => {
    if (!canSubmit) return;
    addRelationship({ sourceId, targetId, cardinality });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add relationship</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={SELECT_CLASS}>
            <option value="" disabled>
              Source entity
            </option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={SELECT_CLASS}>
            <option value="" disabled>
              Target entity
            </option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <select
            value={cardinality}
            onChange={(e) => setCardinality(e.target.value as Cardinality)}
            className={SELECT_CLASS}
          >
            <option value="1:1">1:1</option>
            <option value="1:N">1:N</option>
            <option value="N:M">N:M</option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
