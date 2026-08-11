import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateDialog } from "@/scene/CreateDialog";
import { Overlay } from "@/scene/Overlay";
import { Scene } from "@/scene/Scene";
import { fetchProjectDetail, fetchProjectList, saveProject } from "@/store/api";
import { useAutosave } from "@/store/persistence";
import { serializeProject } from "@/store/serialize";
import { useModelStore } from "@/store/store";

type Status = "loading" | "ready" | "empty" | "error";

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh w-svw items-center justify-center">
      <p className="text-muted-foreground text-base">{children}</p>
    </div>
  );
}

function App() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [creatingFirstProject, setCreatingFirstProject] = useState(false);
  // Tracks which projects already have their data hydrated into the store, so re-selecting a
  // project already visited this session (Header's switcher) doesn't re-fetch it — plan.md:
  // "once fetched, stays in the store." A ref rather than state since it never needs to trigger
  // a re-render on its own.
  const loadedProjectIds = useRef(new Set<string>());

  const loadProject = useCallback(async (id: string) => {
    if (!loadedProjectIds.current.has(id)) {
      const detail = await fetchProjectDetail(id);
      useModelStore.getState().hydrateProject(detail);
      loadedProjectIds.current.add(id);
    }
    setProjectId(id);
  }, []);

  // A freshly created project only exists in the local store until this immediate (non-debounced)
  // save — without it, closing the tab before the Layer 5 autosave debounce fires would lose the
  // project entirely.
  const createProject = useCallback(async (name: string) => {
    const id = useModelStore.getState().addProject({ name });
    await saveProject(id, serializeProject(useModelStore.getState(), id));
    loadedProjectIds.current.add(id);
    setProjectId(id);
    setStatus("ready");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProjectList();
        if (list.length === 0) {
          setStatus("empty");
          return;
        }
        await loadProject(list[0].id);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load projects from the server", err);
        setStatus("error");
      }
    })();
  }, [loadProject]);

  // No-ops until projectId is set (see persistence.ts) — called unconditionally, before the
  // early returns below, since hooks can't be called conditionally.
  useAutosave(projectId);

  if (status === "loading") return <CenteredMessage>Loading…</CenteredMessage>;
  if (status === "error") {
    return (
      <CenteredMessage>
        Couldn't reach the server — is it running? (<code>bun run dev:server</code>)
      </CenteredMessage>
    );
  }
  if (status === "empty" || projectId === null) {
    return (
      <div className="flex h-svh w-svw flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-base">No projects yet.</p>
        <Button onClick={() => setCreatingFirstProject(true)}>Create a project</Button>
        <CreateDialog
          open={creatingFirstProject}
          onOpenChange={setCreatingFirstProject}
          title="New project"
          placeholder="Project name"
          onSubmit={(name) => createProject(name)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-svh w-svw">
      <Scene projectId={projectId} />
      <Overlay projectId={projectId} onProjectChange={loadProject} onCreateProject={createProject} />
    </div>
  );
}

export default App;
