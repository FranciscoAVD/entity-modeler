import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/store";
import { AddRelationshipDialog } from "./AddRelationshipDialog";
import { CreateDialog } from "./CreateDialog";
import { SidebarSearch } from "./SidebarSearch";
import { SidebarTree } from "./SidebarTree";

export type PendingCreate =
  | { type: "space" }
  | { type: "orbit"; spaceId: string }
  | { type: "node"; spaceId: string; orbitId?: string };

const DIALOG_CONFIG: Record<
  PendingCreate["type"],
  { title: string; placeholder: string }
> = {
  space: { title: "New space", placeholder: "Space name" },
  orbit: { title: "New orbit", placeholder: "Orbit name" },
  node: { title: "New node", placeholder: "Node name" },
};

function SectionHeader({
  label,
  menuLabel,
  onAction,
}: {
  label: string;
  menuLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </h2>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="icon" size="icon-xs">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onAction}>{menuLabel}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const project = useModelStore((state) => state.projects.get(projectId));
  const addSpace = useModelStore((state) => state.addSpace);
  const addOrbit = useModelStore((state) => state.addOrbit);
  const addEntity = useModelStore((state) => state.addEntity);

  const [pending, setPending] = useState<PendingCreate | null>(null);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);

  const handleCreate = (name: string) => {
    if (!pending) return;
    switch (pending.type) {
      case "space":
        addSpace({ projectId, name });
        break;
      case "orbit":
        addOrbit({ spaceId: pending.spaceId, name });
        break;
      case "node":
        addEntity({ spaceId: pending.spaceId, orbitId: pending.orbitId, name });
        break;
    }
  };

  return (
    <div
      className={cn(
        "bg-card/70 flex flex-col overflow-hidden border-r backdrop-blur",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-3">
        <div>
          <h2 className="font-medium text-primary uppercase">
            {project?.name}
          </h2>
          {project?.description && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {project.description}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
            Search
          </h2>
          <SidebarSearch />
        </div>

        <div>
          <SectionHeader
            label="Relationships"
            menuLabel="Add relationship"
            onAction={() => setRelationshipDialogOpen(true)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-3">
        <SectionHeader
          label="Spaces"
          menuLabel="Add space"
          onAction={() => setPending({ type: "space" })}
        />
        <SidebarTree projectId={projectId} onRequestCreate={setPending} />
      </div>

      <CreateDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? DIALOG_CONFIG[pending.type].title : ""}
        placeholder={
          pending ? DIALOG_CONFIG[pending.type].placeholder : undefined
        }
        onSubmit={handleCreate}
      />
      <AddRelationshipDialog
        open={relationshipDialogOpen}
        onOpenChange={setRelationshipDialogOpen}
        projectId={projectId}
      />
    </div>
  );
}
