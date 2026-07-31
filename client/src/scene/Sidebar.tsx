import { Plus } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { allProjects } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { AddRelationshipDialog } from "./AddRelationshipDialog";
import { CreateDialog } from "./CreateDialog";
import { SidebarSearch } from "./SidebarSearch";
import { SidebarTree } from "./SidebarTree";

export type PendingCreate =
  | { type: "project" }
  | { type: "space" }
  | { type: "orbit"; spaceId: string }
  | { type: "node"; spaceId: string; orbitId?: string };

const DIALOG_CONFIG: Record<PendingCreate["type"], { title: string; placeholder: string }> = {
  project: { title: "New project", placeholder: "Project name" },
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
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</h2>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={menuLabel}
            className="hover:bg-muted text-muted-foreground hover:text-foreground rounded p-0.5"
          >
            <Plus className="size-3.5" />
          </button>
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
  onProjectChange,
}: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}) {
  const projects = useModelStore(useShallow((state) => allProjects(state)));
  const addProject = useModelStore((state) => state.addProject);
  const addSpace = useModelStore((state) => state.addSpace);
  const addOrbit = useModelStore((state) => state.addOrbit);
  const addEntity = useModelStore((state) => state.addEntity);

  const [pending, setPending] = useState<PendingCreate | null>(null);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);

  const handleCreate = (name: string) => {
    if (!pending) return;
    switch (pending.type) {
      case "project":
        onProjectChange(addProject({ name }));
        break;
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
    <div className="bg-card/95 border-border absolute inset-y-0 left-0 flex w-72 flex-col gap-4 overflow-y-auto border-r p-3 backdrop-blur">
      <div>
        <SectionHeader label="Project" menuLabel="New project" onAction={() => setPending({ type: "project" })} />
        <select
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="border-border bg-background w-full rounded border px-1.5 py-1 text-sm font-medium"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">Search</h2>
        <SidebarSearch />
      </div>

      <div>
        <SectionHeader
          label="Relationships"
          menuLabel="Add relationship"
          onAction={() => setRelationshipDialogOpen(true)}
        />
      </div>

      <div>
        <SectionHeader label="Spaces" menuLabel="Add space" onAction={() => setPending({ type: "space" })} />
        <SidebarTree projectId={projectId} onRequestCreate={setPending} />
      </div>

      <CreateDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? DIALOG_CONFIG[pending.type].title : ""}
        placeholder={pending ? DIALOG_CONFIG[pending.type].placeholder : undefined}
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
