import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { entitiesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Cardinality } from "@/store/types";

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
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Source entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Target entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cardinality}
            onValueChange={(value) => setCardinality(value as Cardinality)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="1:N">1:N</SelectItem>
              <SelectItem value="N:M">N:M</SelectItem>
            </SelectContent>
          </Select>
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
