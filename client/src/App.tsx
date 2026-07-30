import { useState } from "react";
import { Scene } from "@/scene/Scene";
import { VisibilityPanel } from "@/scene/VisibilityPanel";
import { seedDemoProject } from "@/store/seed";

function App() {
  const [projectId] = useState(() => seedDemoProject());

  return (
    <div className="relative h-svh w-svw">
      <Scene projectId={projectId} />
      <VisibilityPanel projectId={projectId} />
    </div>
  );
}

export default App;
