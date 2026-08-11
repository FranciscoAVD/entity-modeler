import { Plus } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { allProjects } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { CreateDialog } from "./CreateDialog";
import { TabBar } from "./TabBar";
import { useViewStore } from "./viewStore";

export function Header({
  projectId,
  onProjectChange,
  onCreateProject,
  className,
}: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  className?: string;
}) {
  const projects = useModelStore(useShallow((state) => allProjects(state)));
  const requestResetView = useViewStore((state) => state.requestResetView);
  const saveStatus = useViewStore((state) => state.saveStatus);
  const [creatingProject, setCreatingProject] = useState(false);

  return (
    <div
      className={cn(
        "bg-card/90 flex items-center justify-between gap-3 border-b px-3 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Select value={projectId} onValueChange={onProjectChange}>
          <SelectTrigger className="w-56 font-medium">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="icon"
          size="icon-xs"
          onClick={() => setCreatingProject(true)}
        >
          <Plus />
        </Button>
      </div>

      <TabBar />

      {saveStatus !== "idle" && (
        <span
          className={cn(
            "text-sm",
            saveStatus === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
        </span>
      )}

      <Button onClick={requestResetView}>Reset view</Button>

      <CreateDialog
        open={creatingProject}
        onOpenChange={setCreatingProject}
        title="New project"
        placeholder="Project name"
        onSubmit={onCreateProject}
      />
    </div>
  );
}
