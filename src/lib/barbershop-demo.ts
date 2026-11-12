export type UserRole = "owner" | "barber";

export type BookingStatus = "confirmed" | "completed" | "canceled" | "no-show";

export type Barber = {
  id: string;
  name: string;
  initials: string;
  title: string;
  color: string;
  phone: string;
  email: string;
  active: boolean;
  workDays: number[];
  serviceIds: string[];
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  serviceDurations: Record<string, number>;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  active: boolean;
};

export type Appointment = {
  id: string;
  date: string;
  time: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  duration: number;
  price: number;
  status: BookingStatus;
  paid: boolean;
  createdAt: string;
  manageToken: string;
};

export type ProductSale = {
  id: string;
  productId: string;
  barberId: string;
  quantity: number;
  unitPrice: number;
  date: string;
  paid: boolean;
};

export type BookingNotification = {
  id: string;
  appointmentId: string;
  createdAt: string;
  read: boolean;
};

export type ShopSettings = {
  name: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  accent: string;
  logoText: string;
  logoUrl: string;
  timezone: string;
  cancellationHours: number;
  openTime: string;
  closeTime: string;
};

export type DemoWorkspace = {
  settings: ShopSettings;
  barbers: Barber[];
  services: Service[];
  products: Product[];
  appointments: Appointment[];
  notifications: BookingNotification[];
  sales: ProductSale[];
};

export const DEMO_STORAGE_KEY = "prosperous-barbershop-demo-v1";

export const ACCENT_OPTIONS = [
  { name: "Preto", value: "#111318" },
  { name: "Branco", value: "#f3f4f6" },
  { name: "Âmbar", value: "#f0a646" },
  { name: "Cobre", value: "#d47b46" },
  { name: "Laranja", value: "#f97316" },
  { name: "Vermelho", value: "#ef4444" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Roxo", value: "#8b5cf6" },
  { name: "Violeta", value: "#a855f7" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Azul-claro", value: "#38bdf8" },
  { name: "Índigo", value: "#6366f1" },
  { name: "Turquesa", value: "#14b8a6" },
  { name: "Verde", value: "#22c55e" },
  { name: "Verde-lima", value: "#b8e27b" },
  { name: "Azul-petróleo", value: "#0f766e" },
  { name: "Marrom", value: "#92400e" },
  { name: "Vinho", value: "#c57583" },
];

export const TODAY_LABEL = "2026-11-11";

function addDays(date: string, amount: number) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const result = new Date(year, month - 1, day + amount);
  return [
    result.getFullYear(),
    String(result.getMonth() + 1).padStart(2, "0"),
    String(result.getDate()).padStart(2, "0"),
  ].join("-");
}

function makeAppointment(
  baseDate: string,
  index: number,
  barberId: string,
  serviceId: string,
  clientName: string,
  clientPhone: string,
  clientEmail: string,
  time: string,
  duration: number,
  price: number,
  status: BookingStatus,
  paid: boolean,
): Appointment {
  return {
    id: `ag-${index}`,
    date: baseDate,
    time,
    barberId,
    serviceId,
    clientName,
    clientPhone,
    clientEmail,
    duration,
    price,
    status,
    paid,
    createdAt: `${baseDate}T08:30:00-03:00`,
    manageToken: `demo-token-${index}`,
  };
}

export function createDemoWorkspace(today = TODAY_LABEL): DemoWorkspace {
  const services: Service[] = [
    {
      id: "corte",
      name: "Corte clássico",
      description: "Tesoura ou máquina, acabamento caprichado.",
      price: 55,
      duration: 45,
      category: "Cabelo",
      active: true,
    },
    {
      id: "degrade",
      name: "Degradê",
      description: "Degradê personalizado com acabamento na navalha.",
      price: 65,
      duration: 50,
      category: "Cabelo",
      active: true,
    },
    {
      id: "barba",
      name: "Barba desenhada",
      description: "Toalha quente, desenho e finalização.",
      price: 40,
      duration: 35,
      category: "Barba",
      active: true,
    },
    {
      id: "combo",
      name: "Corte + barba",
      description: "O ritual completo para sair alinhado.",
      price: 95,
      duration: 80,
      category: "Combos",
      active: true,
    },
  ];

  const barbers: Barber[] = [
    {
      id: "rafael",
      name: "Rafael Fonseca",
      initials: "RF",
      title: "Barbeiro e proprietário",
      color: "#b8e27b",
      phone: "5511999991001",
      email: "rafael@example.com",
      active: true,
      workDays: [1, 2, 3, 4, 5, 6],
      serviceIds: ["corte", "degrade", "barba", "combo"],
      startTime: "09:00",
      endTime: "19:00",
      breakStart: "13:00",
      breakEnd: "14:00",
      serviceDurations: { corte: 45, degrade: 50, barba: 35, combo: 80 },
    },
    {
      id: "lex",
      name: "Lex Oliveira",
      initials: "LO",
      title: "Especialista em degradê",
      color: "#d8955d",
      phone: "5511999991002",
      email: "lex@example.com",
      active: true,
      workDays: [1, 2, 3, 4, 5, 6],
      serviceIds: ["corte", "degrade", "barba", "combo"],
      startTime: "10:00",
      endTime: "20:00",
      breakStart: "14:00",
      breakEnd: "15:00",
      serviceDurations: { corte: 40, degrade: 45, barba: 35, combo: 75 },
    },
    {
      id: "roberto",
      name: "Roberto Lima",
      initials: "RL",
      title: "Barbeiro clássico",
      color: "#cb8f88",
      phone: "5511999991003",
      email: "roberto@example.com",
      active: true,
      workDays: [1, 2, 3, 4, 5, 6],
      serviceIds: ["corte", "degrade", "barba", "combo"],
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "12:30",
      breakEnd: "13:30",
      serviceDurations: { corte: 50, degrade: 55, barba: 40, combo: 90 },
    },
  ];

  const products: Product[] = [
    {
      id: "pomada",
      name: "Pomada Matte",
      description: "Fixação natural, acabamento sem brilho.",
      price: 49,
      category: "Finalização",
      active: true,
    },
    {
      id: "oleo",
      name: "Óleo para Barba",
      description: "Blend leve para hidratar e perfumar.",
      price: 42,
      category: "Barba",
      active: true,
    },
    {
      id: "shampoo",
      name: "Shampoo Diário",
      description: "Limpeza suave para cabelo e couro cabeludo.",
      price: 38,
      category: "Cuidado",
      active: true,
    },
  ];

  const appointments = [
    makeAppointment(
      today,
      1,
      "rafael",
      "corte",
      "Caio Martins",
      "5511988880101",
      "caio@example.com",
      "09:00",
      45,
      55,
      "completed",
      true,
    ),
    makeAppointment(
      today,
      2,
      "lex",
      "degrade",
      "Bruno Alves",
      "5511988880102",
      "bruno@example.com",
      "09:30",
      45,
      65,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      3,
      "roberto",
      "combo",
      "André Costa",
      "5511988880103",
      "andre@example.com",
      "10:00",
      90,
      95,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      4,
      "rafael",
      "barba",
      "Pedro Rocha",
      "5511988880104",
      "pedro@example.com",
      "10:00",
      35,
      40,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      5,
      "lex",
      "corte",
      "Davi Nunes",
      "5511988880105",
      "davi@example.com",
      "11:00",
      40,
      55,
      "completed",
      true,
    ),
    makeAppointment(
      today,
      6,
      "rafael",
      "combo",
      "Lucas Freitas",
      "5511988880106",
      "lucas@example.com",
      "11:00",
      80,
      95,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      7,
      "roberto",
      "barba",
      "Mateus Silva",
      "5511988880107",
      "mateus@example.com",
      "12:00",
      40,
      40,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      8,
      "lex",
      "degrade",
      "Igor Melo",
      "5511988880108",
      "igor@example.com",
      "13:30",
      45,
      65,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      9,
      "rafael",
      "corte",
      "Felipe Ramos",
      "5511988880109",
      "felipe@example.com",
      "14:00",
      45,
      55,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      10,
      "roberto",
      "corte",
      "Gustavo Reis",
      "5511988880110",
      "gustavo@example.com",
      "14:30",
      50,
      55,
      "completed",
      true,
    ),
    makeAppointment(
      today,
      11,
      "lex",
      "combo",
      "Thiago Braga",
      "5511988880111",
      "thiago@example.com",
      "15:00",
      75,
      95,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      12,
      "rafael",
      "degrade",
      "Enzo Duarte",
      "5511988880112",
      "enzo@example.com",
      "16:00",
      50,
      65,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      13,
      "roberto",
      "combo",
      "Vitor Barros",
      "5511988880113",
      "vitor@example.com",
      "16:30",
      90,
      95,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      14,
      "lex",
      "barba",
      "Samuel Pires",
      "5511988880114",
      "samuel@example.com",
      "17:00",
      35,
      40,
      "confirmed",
      false,
    ),
    makeAppointment(
      today,
      15,
      "rafael",
      "corte",
      "Daniel Lopes",
      "5511988880115",
      "daniel@example.com",
      "18:00",
      45,
      55,
      "confirmed",
      false,
    ),
  ];

  return {
    settings: {
      name: "Prosperous Barbershop",
      slug: "prosperous-barbershop",
      ownerName: "Rafael Fonseca",
      email: "agenda@prosperousbarbershop.com.br",
      phone: "5511999990000",
      address: "Rua dos Barbeiros, 128 · São Paulo, SP",
      accent: ACCENT_OPTIONS[0]!.value,
      logoText: "P",
      logoUrl: "",
      timezone: "America/Sao_Paulo",
      cancellationHours: 2,
      openTime: "09:00",
      closeTime: "20:00",
    },
    barbers,
    services,
    products,
    appointments,
    notifications: [],
    sales: [
      {
        id: "venda-1",
        productId: "pomada",
        barberId: "rafael",
        quantity: 1,
        unitPrice: 49,
        date: today,
        paid: true,
      },
      {
        id: "venda-2",
        productId: "oleo",
        barberId: "lex",
        quantity: 1,
        unitPrice: 42,
        date: today,
        paid: true,
      },
      {
        id: "venda-3",
        productId: "shampoo",
        barberId: "roberto",
        quantity: 2,
        unitPrice: 38,
        date: today,
        paid: true,
      },
    ],
  };
}

export function loadDemoWorkspace(): DemoWorkspace {
  if (typeof window === "undefined") return createDemoWorkspace();
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return createDemoWorkspace(new Date().toLocaleDateString("en-CA"));
    const parsed = JSON.parse(raw) as DemoWorkspace;
    if (!parsed.settings || !Array.isArray(parsed.appointments)) return createDemoWorkspace();
    const defaults = createDemoWorkspace(new Date().toLocaleDateString("en-CA"));
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...parsed.settings },
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return createDemoWorkspace(new Date().toLocaleDateString("en-CA"));
  }
}

export function saveDemoWorkspace(workspace: DemoWorkspace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // The demo remains usable in memory when browser storage is disabled.
  }
}

export function serviceDuration(barber: Barber, service: Service) {
  return barber.serviceDurations[service.id] ?? service.duration;
}

function toMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function hasAppointmentConflict(
  appointments: Appointment[],
  barberId: string,
  date: string,
  time: string,
  duration: number,
  excludeId?: string,
) {
  const start = toMinutes(time);
  const end = start + duration;
  return appointments.some((appointment) => {
    if (
      appointment.id === excludeId ||
      appointment.barberId !== barberId ||
      appointment.date !== date ||
      appointment.status === "canceled"
    )
      return false;
    const appointmentStart = toMinutes(appointment.time);
    const appointmentEnd = appointmentStart + appointment.duration;
    return start < appointmentEnd && end > appointmentStart;
  });
}

export function getAvailableSlots(
  workspace: DemoWorkspace,
  barber: Barber,
  service: Service,
  date: string,
  stepMinutes = 30,
) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  if (!barber.active || !barber.workDays.includes(weekday)) return [] as string[];
  if (!barber.serviceIds.includes(service.id) || !service.active) return [] as string[];

  const duration = serviceDuration(barber, service);
  const dayStart = Math.max(toMinutes(barber.startTime), toMinutes(workspace.settings.openTime));
  const dayEnd = Math.min(toMinutes(barber.endTime), toMinutes(workspace.settings.closeTime));
  const breakStart = toMinutes(barber.breakStart);
  const breakEnd = toMinutes(barber.breakEnd);
  const options: string[] = [];

  for (let start = dayStart; start + duration <= dayEnd; start += stepMinutes) {
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    const end = start + duration;
    const overlapsBreak = start < breakEnd && end > breakStart;
    const conflict = hasAppointmentConflict(
      workspace.appointments,
      barber.id,
      date,
      time,
      duration,
    );
    if (!overlapsBreak && !conflict) options.push(time);
  }
  return options;
}

export function createBooking(
  workspace: DemoWorkspace,
  input: Omit<Appointment, "id" | "status" | "paid" | "createdAt" | "manageToken">,
): {
  workspace: DemoWorkspace;
  appointment?: Appointment;
  error?: "slot-taken" | "slot-unavailable";
} {
  const barber = workspace.barbers.find((item) => item.id === input.barberId && item.active);
  const service = workspace.services.find((item) => item.id === input.serviceId && item.active);
  if (
    !barber ||
    !service ||
    !barber.serviceIds.includes(service.id) ||
    service.price !== input.price ||
    serviceDuration(barber, service) !== input.duration
  ) {
    return { workspace, error: "slot-unavailable" };
  }
  const availableSlots = getAvailableSlots(workspace, barber, service, input.date);
  if (!availableSlots.includes(input.time)) {
    return {
      workspace,
      error: hasAppointmentConflict(
        workspace.appointments,
        input.barberId,
        input.date,
        input.time,
        input.duration,
      )
        ? "slot-taken"
        : "slot-unavailable",
    };
  }
  const appointment: Appointment = {
    ...input,
    id: `ag-${Date.now().toString(36)}`,
    status: "confirmed",
    paid: false,
    createdAt: new Date().toISOString(),
    manageToken: `manage-${Math.random().toString(36).slice(2, 14)}`,
  };
  return {
    workspace: {
      ...workspace,
      appointments: [...workspace.appointments, appointment],
      notifications: [
        {
          id: `notif-${appointment.id}`,
          appointmentId: appointment.id,
          createdAt: appointment.createdAt,
          read: false,
        },
        ...workspace.notifications,
      ],
    },
    appointment,
  };
}

export function getRevenue(workspace: DemoWorkspace, barberId?: string, datePrefix?: string) {
  const appointmentRevenue = workspace.appointments
    .filter((appointment) => appointment.paid && appointment.status !== "canceled")
    .filter((appointment) => !barberId || appointment.barberId === barberId)
    .filter((appointment) => !datePrefix || appointment.date.startsWith(datePrefix))
    .reduce((sum, appointment) => sum + appointment.price, 0);
  const productRevenue = workspace.sales
    .filter((sale) => sale.paid)
    .filter((sale) => !barberId || sale.barberId === barberId)
    .filter((sale) => !datePrefix || sale.date.startsWith(datePrefix))
    .reduce((sum, sale) => sum + sale.unitPrice * sale.quantity, 0);
  return appointmentRevenue + productRevenue;
}

export function getAppointmentCount(
  workspace: DemoWorkspace,
  barberId?: string,
  datePrefix?: string,
) {
  return workspace.appointments
    .filter((appointment) => appointment.status !== "canceled")
    .filter((appointment) => !barberId || appointment.barberId === barberId)
    .filter((appointment) => !datePrefix || appointment.date.startsWith(datePrefix)).length;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortDate(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(year, month - 1, day),
  );
}

export function formatFullDate(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

export function demoDateOffset(date: string, amount: number) {
  return addDays(date, amount);
}
