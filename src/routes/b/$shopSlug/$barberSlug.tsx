import { createFileRoute } from "@tanstack/react-router";

import { DemoWorkspaceProvider } from "@/components/barbershop/demo-workspace";
import { PublicBookingRoute } from "@/components/barbershop/PublicBookingRoute";

export const Route = createFileRoute("/b/$shopSlug/$barberSlug")({
  head: () => ({
    meta: [
      { title: "Agende com seu barbeiro · Barbearia" },
      { name: "description", content: "Escolha seu serviço e horário." },
    ],
  }),
  component: BarberBookingPage,
});

function BarberBookingPage() {
  const { shopSlug, barberSlug } = Route.useParams();
  return (
    <DemoWorkspaceProvider>
      <PublicBookingRoute shopSlug={shopSlug} barberSlug={barberSlug} />
    </DemoWorkspaceProvider>
  );
}
