import { createFileRoute } from "@tanstack/react-router";

import { CentralDashboard } from "@/components/barbershop/CentralDashboard";

export const Route = createFileRoute("/central")({
  head: () => ({ meta: [{ title: "Central de barbearias · Agenda" }] }),
  component: CentralDashboard,
});
