import { createFileRoute } from "@tanstack/react-router";

import { DemoWorkspaceProvider } from "@/components/barbershop/demo-workspace";
import { PublicBookingRoute } from "@/components/barbershop/PublicBookingRoute";

export const Route = createFileRoute("/b/$shopSlug")({
  head: () => ({
    meta: [
      { title: "Agende seu horário · Prosperous Barbershop" },
      { name: "description", content: "Escolha seu serviço e horário." },
    ],
  }),
  component: ShopBookingPage,
});

function ShopBookingPage() {
  const { shopSlug } = Route.useParams();
  return (
    <DemoWorkspaceProvider>
      <PublicBookingRoute shopSlug={shopSlug} />
    </DemoWorkspaceProvider>
  );
}
