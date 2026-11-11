import { useDemoWorkspace } from "@/components/barbershop/demo-workspace-context";
import { BookingFlow } from "@/components/barbershop/BookingFlow";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PublicBookingRoute({
  shopSlug,
  barberSlug,
}: {
  shopSlug: string;
  barberSlug?: string;
}) {
  const { workspace, setWorkspace } = useDemoWorkspace();
  const barber = barberSlug
    ? workspace.barbers.find((item) => item.id === barberSlug || slugify(item.name) === barberSlug)
    : undefined;

  return (
    <BookingFlow
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      {...(barber ? { initialBarberId: barber.id } : {})}
      publicUrl={`/b/${shopSlug}`}
    />
  );
}
