import { useState } from "react";
import { ResetViewButton } from "@/scene/ResetViewButton";
import { Scene } from "@/scene/Scene";
import { Sidebar } from "@/scene/Sidebar";
import { SidePanel } from "@/scene/SidePanel";
import { seedDemoProject } from "@/store/seed";

function App() {
  const [projectId, setProjectId] = useState(() => seedDemoProject());

  return (
    <div className="relative h-svh w-svw">
      <Scene projectId={projectId} />
      <Sidebar projectId={projectId} onProjectChange={setProjectId} />
      <ResetViewButton />
      <SidePanel />
    </div>
  );
}

export default App;
