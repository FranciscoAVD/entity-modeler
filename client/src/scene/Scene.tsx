import { Canvas } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import { relationshipsInProject, spacesInProject } from "@/store/selectors";
import { useModelStore } from "@/store/store";
import { CameraRig } from "./CameraRig";
import { DEFAULT_CAMERA_POSITION } from "./cameraFocus";
import { RelationshipEdge } from "./RelationshipEdge";
import { SpaceBoundary } from "./SpaceBoundary";

export function Scene({ projectId }: { projectId: string }) {
  const spaces = useModelStore(useShallow((state) => spacesInProject(state, projectId)));
  const relationships = useModelStore(
    useShallow((state) => relationshipsInProject(state, projectId)),
  );

  return (
    <Canvas
      camera={{
        position: [DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.y, DEFAULT_CAMERA_POSITION.z],
        fov: 50,
      }}
    >
      <color attach="background" args={["#0b0b12"]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[20, 20, 20]} intensity={0.6} />
      <CameraRig />
      {spaces.map((space) => (
        <SpaceBoundary key={space.id} space={space} />
      ))}
      {relationships.map((relationship) => (
        <RelationshipEdge key={relationship.id} relationship={relationship} />
      ))}
    </Canvas>
  );
}
