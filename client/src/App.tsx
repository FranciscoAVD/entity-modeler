import { useState } from "react";
import { BottomDock } from "@/scene/BottomDock";
import { ResetViewButton } from "@/scene/ResetViewButton";
import { Scene } from "@/scene/Scene";
import { SearchBar } from "@/scene/SearchBar";
import { VisibilityPanel } from "@/scene/VisibilityPanel";
import { seedDemoProject } from "@/store/seed";

function App() {
  const [projectId] = useState(() => seedDemoProject());

  return (
    <div className="relative h-svh w-svw">
      <Scene projectId={projectId} />
      <VisibilityPanel projectId={projectId} />
      <SearchBar />
      <ResetViewButton />
      <BottomDock />
    </div>
  );
}

export default App;
