import { useState } from "react";
import { Overlay } from "@/scene/Overlay";
import { Scene } from "@/scene/Scene";
import { seedDemoProject } from "@/store/seed";

function App() {
  const [projectId, setProjectId] = useState(() => seedDemoProject());

  return (
    <div className="relative h-svh w-svw">
      <Scene projectId={projectId} />
      <Overlay projectId={projectId} onProjectChange={setProjectId} />
    </div>
  );
}

export default App;
