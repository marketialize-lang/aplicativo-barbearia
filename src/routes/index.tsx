import { createFileRoute } from "@tanstack/react-router";

import { DemoWorkspaceProvider } from "@/components/barbershop/demo-workspace";
import { ProsperousApp } from "@/components/barbershop/ProsperousApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prosperous Barbershop · Agenda que ocupa a cadeira" },
      {
        name: "description",
        content: "Agenda, equipe e vendas da barbearia em uma demonstração interativa.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <DemoWorkspaceProvider>
      <ProsperousApp />
    </DemoWorkspaceProvider>
  );
}
