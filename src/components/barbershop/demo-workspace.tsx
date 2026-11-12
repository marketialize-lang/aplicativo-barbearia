import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DemoWorkspaceContext } from "@/components/barbershop/demo-workspace-context";
import {
  createDemoWorkspace,
  DEMO_STORAGE_KEY,
  loadDemoWorkspace,
  saveDemoWorkspace,
  type DemoWorkspace,
} from "@/lib/barbershop-demo";

export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(() => createDemoWorkspace());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWorkspace(loadDemoWorkspace());
    setReady(true);
  }, []);

  useEffect(() => {
    function syncWorkspace(event: StorageEvent) {
      if (event.key === null || event.key === DEMO_STORAGE_KEY) {
        setWorkspace(loadDemoWorkspace());
      }
    }
    window.addEventListener("storage", syncWorkspace);
    return () => window.removeEventListener("storage", syncWorkspace);
  }, []);

  useEffect(() => {
    if (ready) saveDemoWorkspace(workspace);
  }, [ready, workspace]);

  const value = useMemo(
    () => ({
      workspace,
      setWorkspace,
      resetDemo: () => setWorkspace(createDemoWorkspace(new Date().toLocaleDateString("en-CA"))),
      ready,
    }),
    [workspace, ready],
  );

  return <DemoWorkspaceContext.Provider value={value}>{children}</DemoWorkspaceContext.Provider>;
}
