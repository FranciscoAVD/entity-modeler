import { Header } from "./Header";
import { NotePanel } from "./NotePanel";
import { Sidebar } from "./Sidebar";
import { SidePanel } from "./SidePanel";

export function Overlay({
  projectId,
  onProjectChange,
  onCreateProject,
}: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
  onCreateProject: (name: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <Header
        projectId={projectId}
        onProjectChange={onProjectChange}
        onCreateProject={onCreateProject}
        className="pointer-events-auto h-14 shrink-0"
      />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar projectId={projectId} className="pointer-events-auto w-72 shrink-0" />
        {/* Flush against SidePanel's left edge (right-80 = SidePanel's own w-80), wider than it
            since notes run long — see plan.md's Phase 8 notes plan. */}
        <NotePanel className="pointer-events-auto absolute inset-y-0 right-80 w-[28rem]" />
        <SidePanel className="pointer-events-auto absolute inset-y-0 right-0 w-80" />
      </div>
    </div>
  );
}
