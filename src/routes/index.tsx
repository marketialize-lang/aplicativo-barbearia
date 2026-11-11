import { createFileRoute } from "@tanstack/react-router";

import { DemoWorkspaceProvider } from "@/components/barbershop/demo-workspace";
import { ProsperousApp } from "@/components/barbershop/ProsperousApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda da barbearia · Agende seu horário" },
      {
        name: "description",
        content: "Agendamento, equipe e gestão da barbearia.",
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
