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
import { orbitsInSpace, spacesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";

// Radix Select can't use an empty string as an item value, so an orbit-less node is represented
// by this sentinel rather than "" — translated back to `orbitId: undefined` on submit.
const NO_ORBIT = "__none__";

// Modeled on AddRelationshipDialog: two dependent Selects, resynced via useEffect on open since
// this dialog instance is reused across different nodes without unmounting.
export function MoveNodeDialog({
  open,
  onOpenChange,
  nodeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string | null;
}) {
  const node = useModelStore((state) => (nodeId ? state.nodes.get(nodeId) : undefined));
  const space = useModelStore((state) => (node ? state.spaces.get(node.spaceId) : undefined));
  const spaces = useModelStore(
    useShallow((state) => (space ? spacesInProject(state, space.projectId) : [])),
  );
  const moveNode = useModelStore((state) => state.moveNode);

  const [spaceId, setSpaceId] = useState("");
  const [orbitId, setOrbitId] = useState(NO_ORBIT);
  const orbits = useModelStore(useShallow((state) => (spaceId ? orbitsInSpace(state, spaceId) : [])));

  useEffect(() => {
    if (open && node) {
      setSpaceId(node.spaceId);
      setOrbitId(node.orbitId ?? NO_ORBIT);
    }
  }, [open, node]);

  const close = (next: boolean) => {
    onOpenChange(next);
  };

  // Changing space invalidates whatever orbit was selected unless the new space happens to have
  // one with the same id — same "clear the now-invalid dependent selection" pattern
  // AddRelationshipDialog uses when its source change would otherwise leave an invalid target.
  const handleSpaceChange = (value: string) => {
    setSpaceId(value);
    setOrbitId(NO_ORBIT);
  };

  const canSubmit = nodeId && spaceId;

  const submit = () => {
    if (!canSubmit) return;
    moveNode(nodeId, { spaceId, orbitId: orbitId === NO_ORBIT ? undefined : orbitId });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {node?.name ?? "node"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={spaceId} onValueChange={handleSpaceChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Space" />
            </SelectTrigger>
            <SelectContent>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label ?? s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orbitId} onValueChange={setOrbitId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Orbit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORBIT}>No orbit</SelectItem>
              {orbits.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label ?? o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
