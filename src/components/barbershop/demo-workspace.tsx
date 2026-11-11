import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DemoWorkspaceContext } from "@/components/barbershop/demo-workspace-context";
import {
  createDemoWorkspace,
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
