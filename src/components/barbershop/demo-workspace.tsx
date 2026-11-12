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
  const [ownerSession, setOwnerSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isPublicBooking = window.location.pathname.startsWith("/b/");
    const shopSlug = isPublicBooking
      ? window.location.pathname.split("/").filter(Boolean)[1] ?? ""
      : new URLSearchParams(window.location.search).get("shop") ?? "";

    async function loadWorkspace() {
      setReady(false);
      setOwnerSession(false);
      setWorkspace(loadDemoWorkspace());
      try {
        if (isPublicBooking) {
          const response = await fetch(`/api/public-workspace?shop=${encodeURIComponent(shopSlug)}`);
          const result = (await response.json()) as { workspace?: DemoWorkspace | null };
          if (!cancelled && result.workspace) setWorkspace(result.workspace);
        } else {
          const sessionResponse = await fetch("/api/auth/session");
          const session = (await sessionResponse.json()) as { authenticated?: boolean; role?: string; shopSlug?: string };
          if (session.authenticated && session.role === "shop" && (!shopSlug || session.shopSlug === shopSlug)) {
            const response = await fetch("/api/workspace");
            if (response.ok) {
              const result = (await response.json()) as { workspace?: DemoWorkspace | null };
              if (!cancelled) {
                setOwnerSession(true);
                if (result.workspace) setWorkspace(result.workspace);
                else {
                  setWorkspace((current) => ({
                    ...current,
                    appointments: [],
                    notifications: [],
                    sales: [],
                  }));
                }
              }
            }
          }
        }
      } catch {
        // The demo remains available when the Cloudflare API is not configured.
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    const refresh = () => {
      void loadWorkspace();
    };
    window.addEventListener("workspace:refresh", refresh);
    void loadWorkspace();
    return () => {
      cancelled = true;
      window.removeEventListener("workspace:refresh", refresh);
    };
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
    if (ready && (import.meta.env.DEV || !ownerSession)) saveDemoWorkspace(workspace);
  }, [ready, ownerSession, workspace]);

  useEffect(() => {
    if (!ready || !ownerSession || window.location.pathname.startsWith("/b/")) return;
    const timeout = window.setTimeout(() => {
      void fetch("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace }),
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [ownerSession, ready, workspace]);

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
