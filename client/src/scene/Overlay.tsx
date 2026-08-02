import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SidePanel } from "./SidePanel";

export function Overlay({
  projectId,
  onProjectChange,
}: {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <Header
        projectId={projectId}
        onProjectChange={onProjectChange}
        className="pointer-events-auto h-14 shrink-0"
      />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar projectId={projectId} className="pointer-events-auto w-72 shrink-0" />
        <SidePanel className="pointer-events-auto absolute inset-y-0 right-0 w-80" />
      </div>
    </div>
  );
}
