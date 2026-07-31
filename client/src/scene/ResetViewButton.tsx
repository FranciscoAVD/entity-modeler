import { Button } from "@/components/ui/button";
import { useViewStore } from "./viewStore";

export function ResetViewButton() {
  const requestResetView = useViewStore((state) => state.requestResetView);

  return (
    <Button variant="secondary" size="sm" className="absolute top-4 right-4" onClick={requestResetView}>
      Reset view
    </Button>
  );
}
