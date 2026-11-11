import { createContext, useContext } from "react";

import type { DemoWorkspace } from "@/lib/barbershop-demo";

export type DemoWorkspaceContextValue = {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  resetDemo: () => void;
  ready: boolean;
};

export const DemoWorkspaceContext = createContext<DemoWorkspaceContextValue | null>(null);

export function useDemoWorkspace() {
  const context = useContext(DemoWorkspaceContext);
  if (!context) throw new Error("useDemoWorkspace precisa estar dentro de DemoWorkspaceProvider.");
  return context;
}
