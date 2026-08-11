import { useEffect, useState } from "react";
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
import { nodesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import type { Cardinality } from "@/store/types";

// Unlike space/orbit/node quick-add, a relationship has no meaningful "just a name" default —
// it needs two real nodes to connect, so this gets its own dialog instead of CreateDialog.
export function AddRelationshipDialog({
  open,
  onOpenChange,
  projectId,
  initialSourceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialSourceId?: string;
}) {
  const nodes = useModelStore(useShallow((state) => nodesInProject(state, projectId)));
  const addRelationship = useModelStore((state) => state.addRelationship);

  const [sourceId, setSourceId] = useState(initialSourceId ?? "");
  const [targetId, setTargetId] = useState("");
  const [cardinality, setCardinality] = useState<Cardinality>("1:N");

  // This dialog instance is reused across opens without unmounting (e.g. one node row's
  // "Add relationship" after another), so the fields need to be re-synced whenever it opens —
  // a plain useState initializer only runs once, on mount.
  useEffect(() => {
    if (open) {
      setSourceId(initialSourceId ?? "");
      setTargetId("");
      setCardinality("1:N");
    }
  }, [open, initialSourceId]);

  const close = (next: boolean) => {
    onOpenChange(next);
  };

  // No self-relationships (plan.md decision #8), so the source node itself is never a valid
  // target — filtering it out of the list is more direct than making the user discover the rule
  // via a disabled Create button. If a change of source lands on whatever's currently selected
  // as target, that selection is no longer valid, so clear it.
  const handleSourceChange = (value: string) => {
    setSourceId(value);
    if (value === targetId) setTargetId("");
  };
  const targetNodes = nodes.filter((node) => node.id !== sourceId);

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
          <Select value={sourceId} onValueChange={handleSourceChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Source node" />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Target node" />
            </SelectTrigger>
            <SelectContent>
              {targetNodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.name}
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
