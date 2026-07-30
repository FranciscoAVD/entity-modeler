import { Canvas } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import { spacesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { SpaceBoundary } from "./SpaceBoundary";

export function Scene({ projectId }: { projectId: string }) {
  const spaces = useModelStore(useShallow((state) => spacesInProject(state, projectId)));

  return (
    <Canvas
      camera={{ position: [18, 14, 22], fov: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={["#0b0b12"]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[20, 20, 20]} intensity={0.6} />
      {spaces.map((space) => (
        <SpaceBoundary key={space.id} space={space} />
      ))}
    </Canvas>
  );
}
