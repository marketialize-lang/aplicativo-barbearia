import { describe, expect, it } from "vitest";

import {
  createBooking,
  createDemoWorkspace,
  getAvailableSlots,
  getRevenue,
  hasAppointmentConflict,
} from "@/lib/barbershop-demo";

describe("agenda da demonstração", () => {
  it("não oferece horários dentro da pausa nem fora dos dias de trabalho", () => {
    const workspace = createDemoWorkspace("2026-11-16");
    workspace.appointments = [];
    const barber = workspace.barbers.find((item) => item.id === "rafael")!;
    const service = workspace.services.find((item) => item.id === "corte")!;

    const mondaySlots = getAvailableSlots(workspace, barber, service, "2026-11-16");
    const sundaySlots = getAvailableSlots(workspace, barber, service, "2026-11-15");

    expect(mondaySlots).toContain("09:00");
    expect(mondaySlots).not.toContain("12:30");
    expect(mondaySlots).not.toContain("13:00");
    expect(sundaySlots).toEqual([]);
  });

  it("respeita também a janela de funcionamento da loja", () => {
    const workspace = createDemoWorkspace("2026-11-16");
    workspace.appointments = [];
    workspace.settings.openTime = "10:00";
    workspace.settings.closeTime = "11:00";
    const barber = workspace.barbers.find((item) => item.id === "rafael")!;
    const service = workspace.services.find((item) => item.id === "corte")!;

    const slots = getAvailableSlots(workspace, barber, service, "2026-11-16");

    expect(slots).toEqual(["10:00"]);
  });

  it("bloqueia uma segunda reserva sobreposta e libera um horário cancelado", () => {
    const workspace = createDemoWorkspace("2026-11-16");
    workspace.appointments = [];
    const input = {
      date: "2026-11-16",
      time: "09:00",
      barberId: "rafael",
      serviceId: "corte",
      clientName: "Teste Cliente",
      clientPhone: "5511999998888",
      clientEmail: "teste@example.com",
      duration: 45,
      price: 55,
    };

    const first = createBooking(workspace, input);
    expect(first.appointment).toBeDefined();
    expect(createBooking(first.workspace, input).error).toBe("slot-taken");
    expect(
      hasAppointmentConflict(first.workspace.appointments, "rafael", input.date, "09:15", 30),
    ).toBe(true);

    first.workspace.appointments[0]!.status = "canceled";
    expect(createBooking(first.workspace, input).appointment).toBeDefined();
  });

  it("recusa horários fora da disponibilidade e não aceita preço ou duração adulterados", () => {
    const workspace = createDemoWorkspace("2026-11-16");
    workspace.appointments = [];
    const input = {
      date: "2026-11-16",
      time: "13:00",
      barberId: "rafael",
      serviceId: "corte",
      clientName: "Teste Cliente",
      clientPhone: "5511999998888",
      clientEmail: "teste@example.com",
      duration: 45,
      price: 55,
    };

    expect(createBooking(workspace, input).error).toBe("slot-unavailable");
    expect(createBooking(workspace, { ...input, time: "09:00", price: 1 }).error).toBe(
      "slot-unavailable",
    );
  });

  it("soma apenas serviços e produtos pagos, com escopo por barbeiro", () => {
    const workspace = createDemoWorkspace("2026-11-11");

    expect(getRevenue(workspace, undefined, "2026-11-11")).toBe(332);
    expect(getRevenue(workspace, "rafael", "2026-11-11")).toBe(104);
  });
});
