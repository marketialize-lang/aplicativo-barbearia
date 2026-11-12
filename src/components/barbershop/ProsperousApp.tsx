import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  LayoutDashboard,
  Link2,
  Mail,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Scissors,
  Settings2,
  Share2,
  ShoppingBag,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";

import { BookingFlow } from "@/components/barbershop/BookingFlow";
import { useDemoWorkspace } from "@/components/barbershop/demo-workspace-context";
import {
  ACCENT_OPTIONS,
  formatCurrency,
  formatFullDate,
  formatShortDate,
  getAppointmentCount,
  getRevenue,
  serviceDuration,
  type Appointment,
  type Barber,
  type BookingStatus,
  type DemoWorkspace,
  type Product,
  type ProductSale,
  type Service,
  type UserRole,
} from "@/lib/barbershop-demo";

type Screen = "dashboard" | "agenda" | "team" | "services" | "products" | "settings" | "booking";
type Period = "day" | "week" | "month";

const screenLabels: Record<Screen, string> = {
  dashboard: "Visão geral",
  agenda: "Agenda",
  team: "Equipe",
  services: "Serviços",
  products: "Produtos",
  settings: "Configurações",
  booking: "Agendamento",
};

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftDate(date: string, amount: number) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + amount);
  return localDateKey(next);
}

function getPeriodDates(period: Period, today: string) {
  const [year = 1970, month = 1, day = 1] = today.split("-").map(Number);
  const base = new Date(year, month - 1, day);
  if (period === "day") return { start: today, end: today };
  if (period === "month")
    return {
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: localDateKey(new Date(year, month, 0)),
    };
  const start = new Date(base);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDateKey(start), end: localDateKey(end) };
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function totalRevenue(
  workspace: DemoWorkspace,
  barberId: string | undefined,
  start: string,
  end: string,
) {
  const services = workspace.appointments
    .filter((item) => item.paid && item.status !== "canceled" && inRange(item.date, start, end))
    .filter((item) => !barberId || item.barberId === barberId)
    .reduce((sum, item) => sum + item.price, 0);
  const products = workspace.sales
    .filter((item) => item.paid && inRange(item.date, start, end))
    .filter((item) => !barberId || item.barberId === barberId)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return services + products;
}

function sumRange(
  workspace: DemoWorkspace,
  barberId: string | undefined,
  start: string,
  end: string,
) {
  return workspace.appointments
    .filter((item) => item.status !== "canceled" && inRange(item.date, start, end))
    .filter((item) => !barberId || item.barberId === barberId).length;
}

function barberFor(workspace: DemoWorkspace, barberId: string) {
  return workspace.barbers.find((item) => item.id === barberId);
}

function serviceFor(workspace: DemoWorkspace, serviceId: string) {
  return workspace.services.find((item) => item.id === serviceId);
}

function whatsAppUrl(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function playRegisterSound(context: AudioContext) {
  const notes = [1046.5, 1318.5, 1568];
  const start = context.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = start + index * 0.11;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.29);
  });
}

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }
  return { toast, notify };
}

function BrandMark({
  settings,
  small = false,
}: {
  settings: DemoWorkspace["settings"];
  small?: boolean;
}) {
  return (
    <span
      className={`brand-mark ${small ? "brand-mark-small" : ""}`}
      style={{ "--shop-accent": settings.accent } as CSSProperties}
    >
      {settings.logoUrl ? (
        <img src={settings.logoUrl} alt={`Logotipo de ${settings.name}`} />
      ) : (
        settings.logoText || "P"
      )}
    </span>
  );
}

function Avatar({
  barber,
  size = "normal",
}: {
  barber?: Barber | undefined;
  size?: "normal" | "large";
}) {
  return (
    <span
      className={`barber-avatar ${size === "large" ? "barber-avatar-large" : ""}`}
      style={{ "--avatar-color": barber?.color ?? "#b8e27b" } as CSSProperties}
    >
      {barber?.initials ?? "BB"}
    </span>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const label: Record<BookingStatus, string> = {
    confirmed: "Confirmado",
    completed: "Concluído",
    canceled: "Cancelado",
    "no-show": "Não compareceu",
  };
  return (
    <span className={`status-badge status-${status}`}>
      {status === "completed" ? <Check size={12} /> : <span className="status-dot" />}
      {label[status]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  trend,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
  trend?: string;
  tone?: "accent" | "green";
}) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone ?? ""}`}>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">
        {trend && (
          <span className="metric-trend">
            <ArrowUpRight size={13} /> {trend}
          </span>
        )}
        {caption}
      </div>
    </article>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-title-actions">{children}</div>
    </div>
  );
}

function BarChart({
  workspace,
  barberId,
  start,
  end,
}: {
  workspace: DemoWorkspace;
  barberId: string | undefined;
  start: string;
  end: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  const values = days.map((day) => totalRevenue(workspace, barberId, day, day));
  const max = Math.max(1, ...values);
  return (
    <div className="chart-wrap" role="img" aria-label="Faturamento dos últimos sete dias">
      <div className="bar-chart">
        {days.map((day, index) => (
          <div key={day} className="bar-chart-column">
            <span className="bar-chart-value">
              {(values[index] ?? 0) ? formatCurrency(values[index] ?? 0).replace(",00", "") : ""}
            </span>
            <div className="bar-chart-track">
              <span
                style={{
                  height: `${Math.max((values[index] ?? 0) === 0 ? 4 : 12, ((values[index] ?? 0) / max) * 100)}%`,
                }}
              />
            </div>
            <small>
              {new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
                .format(new Date(`${day}T12:00:00`))
                .replace(".", "")}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentRow({
  workspace,
  appointment,
  onMarkPaid,
  onSetStatus,
  compact = false,
}: {
  workspace: DemoWorkspace;
  appointment: Appointment;
  onMarkPaid?: () => void;
  onSetStatus?: (status: BookingStatus) => void;
  compact?: boolean;
}) {
  const barber = barberFor(workspace, appointment.barberId);
  const service = serviceFor(workspace, appointment.serviceId);
  return (
    <div className={`appointment-row ${compact ? "appointment-row-compact" : ""}`}>
      <div className="appointment-time">
        <strong>{appointment.time}</strong>
        <span>{appointment.duration} min</span>
      </div>
      <span
        className="appointment-color"
        style={{ backgroundColor: barber?.color ?? workspace.settings.accent }}
      />
      <Avatar barber={barber} />
      <div className="appointment-person">
        <strong>{appointment.clientName}</strong>
        <span>
          {service?.name ?? "Serviço"} · {barber?.name.split(" ")[0]}
        </span>
      </div>
      <div className="appointment-row-meta">
        <strong>{formatCurrency(appointment.price)}</strong>
        <StatusBadge status={appointment.status} />
      </div>
      {onMarkPaid && appointment.status !== "canceled" && (
        <button
          className={`paid-toggle ${appointment.paid ? "paid" : ""}`}
          onClick={onMarkPaid}
          type="button"
          aria-label={appointment.paid ? "Marcar como não pago" : "Marcar como pago"}
        >
          {appointment.paid ? <CheckCircle2 size={16} /> : <CircleDollarSign size={16} />}
        </button>
      )}
      {onSetStatus && !compact && (
        <select
          className="status-select"
          aria-label={`Status de ${appointment.clientName}`}
          value={appointment.status}
          onChange={(event) => onSetStatus(event.target.value as BookingStatus)}
        >
          <option value="confirmed">Confirmado</option>
          <option value="completed">Concluído</option>
          <option value="canceled">Cancelado</option>
          <option value="no-show">Não compareceu</option>
        </select>
      )}
    </div>
  );
}

function Dashboard({
  workspace,
  role,
  barberId,
  period,
  setPeriod,
  today,
  onNavigate,
  onMarkPaid,
  onSetStatus,
}: {
  workspace: DemoWorkspace;
  role: UserRole;
  barberId: string;
  period: Period;
  setPeriod: (period: Period) => void;
  today: string;
  onNavigate: (screen: Screen) => void;
  onMarkPaid: (appointment: Appointment) => void;
  onSetStatus: (appointment: Appointment, status: BookingStatus) => void;
}) {
  const { start, end } = getPeriodDates(period, today);
  const scopeBarber = role === "barber" ? barberId : undefined;
  const appointments = workspace.appointments
    .filter((item) => item.date === today && (!scopeBarber || item.barberId === scopeBarber))
    .sort((a, b) => a.time.localeCompare(b.time));
  const doneCount = appointments.filter((item) => item.status === "completed").length;
  const confirmedCount = appointments.filter((item) => item.status === "confirmed").length;
  const periodCount = sumRange(workspace, scopeBarber, start, end);
  const periodRevenue = totalRevenue(workspace, scopeBarber, start, end);
  const barber = barberFor(workspace, barberId);

  return (
    <>
      <PageTitle
        eyebrow={role === "owner" ? "PAINEL DA BARBEARIA" : "SEU PAINEL"}
        title={
          role === "owner"
            ? "Sua agenda, em controle."
            : `Bom trabalho, ${barber?.name.split(" ")[0] ?? "barbeiro"}.`
        }
        description={formatFullDate(today).replace(/^./, (char) => char.toUpperCase())}
      >
        <button className="button-outline" onClick={() => onNavigate("booking")} type="button">
          <ExternalLink size={15} /> Ver agendamento público
        </button>
        <button className="button-primary" onClick={() => onNavigate("booking")} type="button">
          <Plus size={16} /> Novo agendamento
        </button>
      </PageTitle>

      <div className="period-toolbar">
        <div className="period-tabs" role="group" aria-label="Período do painel">
          {(["day", "week", "month"] as Period[]).map((item) => (
            <button
              className={period === item ? "active" : ""}
              key={item}
              onClick={() => setPeriod(item)}
              type="button"
            >
              {{ day: "Hoje", week: "Esta semana", month: "Este mês" }[item]}
            </button>
          ))}
        </div>
        <span className="last-update">
          <span /> Painel atualizado agora
        </span>
      </div>

      <section className="metric-grid">
        <MetricCard
          label="Faturamento"
          value={formatCurrency(periodRevenue)}
          caption="serviços pagos + produtos"
          icon={<Wallet size={17} />}
          tone="accent"
        />
        <MetricCard
          label="Atendimentos"
          value={String(periodCount).padStart(2, "0")}
          caption={
            period === "day"
              ? `${confirmedCount} confirmados · ${doneCount} concluídos`
              : "no período selecionado"
          }
          icon={<Scissors size={17} />}
        />
        <MetricCard
          label="Clientes únicos"
          value={String(new Set(appointments.map((item) => item.clientPhone)).size).padStart(
            2,
            "0",
          )}
          caption="agendamentos para hoje"
          icon={<Users size={17} />}
        />
        <MetricCard
          label={role === "owner" ? "Equipe ativa" : "Sua agenda"}
          value={
            role === "owner"
              ? String(workspace.barbers.filter((item) => item.active).length).padStart(2, "0")
              : `${appointments.length} horários`
          }
          caption={role === "owner" ? "barbeiros disponíveis" : "marcados para hoje"}
          icon={role === "owner" ? <UserRound size={17} /> : <CalendarDays size={17} />}
          tone="green"
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel revenue-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">VISÃO FINANCEIRA</span>
              <h2>Receita registrada no período</h2>
            </div>
            <button className="icon-button" aria-label="Mais opções" type="button">
              <MoreHorizontal size={19} />
            </button>
          </div>
          <div className="revenue-panel-summary">
            <strong>{formatCurrency(periodRevenue)}</strong>
            <span>Valores de atendimentos e vendas marcados como pagos</span>
          </div>
          <BarChart workspace={workspace} barberId={scopeBarber} start={start} end={end} />
          <div className="chart-legend">
            <span>
              <i /> Faturamento combinado
            </span>
            <span className="chart-note">Somente serviços e produtos pagos</span>
          </div>
        </article>

        <article className="panel performance-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">DESEMPENHO</span>
              <h2>{role === "owner" ? "Equipe da casa" : "Seus números"}</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate(role === "owner" ? "team" : "agenda")}
              type="button"
            >
              {role === "owner" ? "Ver equipe" : "Ver agenda"} <ArrowRight size={14} />
            </button>
          </div>
          <div className="performance-list">
            {workspace.barbers
              .filter((item) => item.active && (role === "owner" || item.id === barberId))
              .map((item) => {
                const count = sumRange(workspace, item.id, start, end);
                const revenue = totalRevenue(workspace, item.id, start, end);
                return (
                  <div className="performance-row" key={item.id}>
                    <Avatar barber={item} />
                    <div className="performance-person">
                      <strong>{item.name}</strong>
                      <span>{count} atendimentos no período</span>
                      <div className="performance-progress">
                        <span
                          style={{
                            width: `${Math.min(100, Math.max(15, count * 12))}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                    <strong className="performance-money">{formatCurrency(revenue)}</strong>
                  </div>
                );
              })}
          </div>
          <div className="performance-foot">
            <span>
              <span className="status-dot status-dot-green" /> Jornada configurada
            </span>
            <span>
              {workspace.settings.openTime}–{workspace.settings.closeTime}
            </span>
          </div>
        </article>
      </section>

      <section className="panel today-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">
              {today === localDateKey() ? "HOJE" : formatShortDate(today).toUpperCase()}
            </span>
            <h2>Próximos atendimentos</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate("agenda")} type="button">
            Abrir agenda <ArrowRight size={14} />
          </button>
        </div>
        {appointments.length ? (
          <div className="appointment-list">
            {appointments.slice(0, 6).map((item) => (
              <AppointmentRow
                key={item.id}
                workspace={workspace}
                appointment={item}
                onMarkPaid={() => onMarkPaid(item)}
                onSetStatus={(status) => onSetStatus(item, status)}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CalendarDays size={20} />
            <strong>Sem horários marcados para este dia.</strong>
            <button className="text-button" onClick={() => onNavigate("booking")} type="button">
              Agendar um atendimento <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function AgendaPage({
  workspace,
  setWorkspace,
  role,
  barberId,
  today,
  onNewAppointment,
  onNotify,
}: {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  role: UserRole;
  barberId: string;
  today: string;
  onNewAppointment: () => void;
  onNotify: (message: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [filterBarber, setFilterBarber] = useState(role === "barber" ? barberId : "all");
  const [filterStatus, setFilterStatus] = useState("all");
  const appointments = workspace.appointments
    .filter(
      (item) =>
        item.date === date &&
        (role === "barber"
          ? item.barberId === barberId
          : filterBarber === "all" || item.barberId === filterBarber) &&
        (filterStatus === "all" || item.status === filterStatus),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const updateAppointment = (appointment: Appointment, update: Partial<Appointment>) =>
    setWorkspace({
      ...workspace,
      appointments: workspace.appointments.map((item) =>
        item.id === appointment.id ? { ...item, ...update } : item,
      ),
    });

  return (
    <>
      <PageTitle
        eyebrow="AGENDA DA EQUIPE"
        title="Cada horário no lugar."
        description="Organize o dia e acompanhe cada atendimento."
      >
        <button className="button-primary" onClick={onNewAppointment} type="button">
          <Plus size={16} /> Novo agendamento
        </button>
      </PageTitle>
      <section className="panel agenda-panel">
        <div className="agenda-toolbar">
          <div className="date-switcher">
            <button
              className="icon-button"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Dia anterior"
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button className="date-switcher-current" onClick={() => setDate(today)} type="button">
              {date === today ? "Hoje" : formatShortDate(date)}
            </button>
            <button
              className="icon-button"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Próximo dia"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
            <span>{formatFullDate(date)}</span>
          </div>
          <div className="agenda-filters">
            {role === "owner" && (
              <label className="filter-control">
                <UserRound size={14} />
                <select
                  aria-label="Filtrar barbeiro"
                  value={filterBarber}
                  onChange={(event) => setFilterBarber(event.target.value)}
                >
                  <option value="all">Todos os barbeiros</option>
                  {workspace.barbers
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                <ChevronDown size={14} />
              </label>
            )}
            <label className="filter-control">
              <Filter size={14} />
              <select
                aria-label="Filtrar status"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="confirmed">Confirmados</option>
                <option value="completed">Concluídos</option>
                <option value="canceled">Cancelados</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        <div className="agenda-summary">
          <span>
            <strong>{appointments.length}</strong> atendimentos
          </span>
          <span>
            <strong>{appointments.filter((item) => item.paid).length}</strong> pagos
          </span>
          <span>
            <strong>
              {formatCurrency(
                appointments.filter((item) => item.paid).reduce((sum, item) => sum + item.price, 0),
              )}
            </strong>{" "}
            recebido
          </span>
        </div>
        {appointments.length ? (
          <div className="appointment-list appointment-list-full">
            {appointments.map((item) => (
              <AppointmentRow
                key={item.id}
                workspace={workspace}
                appointment={item}
                onMarkPaid={() => {
                  updateAppointment(item, { paid: !item.paid });
                  onNotify(item.paid ? "Pagamento removido do registro." : "Pagamento registrado.");
                }}
                onSetStatus={(status) => {
                  updateAppointment(item, { status });
                  onNotify("Status do atendimento atualizado.");
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CalendarDays size={20} />
            <strong>Nenhum agendamento para este filtro.</strong>
            <button className="button-outline" onClick={onNewAppointment} type="button">
              Criar agendamento
            </button>
          </div>
        )}
        <div className="panel-footnote">
          <span className="demo-note-dot" /> Demonstração interativa · os dados ficam apenas neste
          navegador.
        </div>
      </section>
    </>
  );
}

function TeamPage({
  workspace,
  setWorkspace,
  role,
  barberId,
  onNotify,
}: {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  role: UserRole;
  barberId: string;
  onNotify: (message: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const barbers = workspace.barbers.filter(
    (item) =>
      (role === "owner" || item.id === barberId) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );

  function addBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!name) return;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
    const id = `barber-${Date.now().toString(36)}`;
    const barber: Barber = {
      id,
      name,
      initials,
      title: "Barbeiro da equipe",
      color: ACCENT_OPTIONS[1]!.value,
      phone: String(form.get("phone") ?? "").replace(/\D/g, ""),
      email,
      active: true,
      workDays: [1, 2, 3, 4, 5, 6],
      serviceIds: workspace.services.map((service) => service.id),
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "13:00",
      breakEnd: "14:00",
      serviceDurations: Object.fromEntries(
        workspace.services.map((service) => [service.id, service.duration]),
      ),
    };
    setWorkspace({ ...workspace, barbers: [...workspace.barbers, barber] });
    setAddOpen(false);
    onNotify("Barbeiro adicionado à demonstração.");
  }

  function updateBarber(id: string, update: Partial<Barber>) {
    setWorkspace({
      ...workspace,
      barbers: workspace.barbers.map((item) => (item.id === id ? { ...item, ...update } : item)),
    });
  }

  return (
    <>
      <PageTitle
        eyebrow={role === "owner" ? "PESSOAS DA CASA" : "SUA DISPONIBILIDADE"}
        title={role === "owner" ? "Uma equipe, três estilos." : "Seu horário, do seu jeito."}
        description={
          role === "owner"
            ? "Ajuste a disponibilidade e a duração dos serviços por barbeiro."
            : "Defina seus dias, horários, pausas e duração dos serviços."
        }
      >
        {role === "owner" && (
          <button className="button-primary" onClick={() => setAddOpen(true)} type="button">
            <Plus size={16} /> Adicionar barbeiro
          </button>
        )}
      </PageTitle>
      {role === "barber" && (
        <div className="inline-notice">
          <Eye size={16} /> Você está ajustando somente sua disponibilidade nesta demonstração.
        </div>
      )}
      <div className="team-toolbar">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar barbeiro..."
          />
        </label>
        <span>{barbers.length} profissionais</span>
      </div>
      <div className="team-list">
        {barbers.map((barber) => {
          const count = getAppointmentCount(workspace, barber.id, localDateKey());
          const revenue = getRevenue(workspace, barber.id, localDateKey());
          const editing = editingId === barber.id;
          return (
            <article
              className={`team-card ${!barber.active ? "team-card-inactive" : ""}`}
              key={barber.id}
            >
              <div className="team-card-main">
                <Avatar barber={barber} size="large" />
                <div className="team-card-copy">
                  <div className="team-card-heading">
                    <h2>{barber.name}</h2>
                    <span className={`member-tag ${barber.active ? "member-active" : ""}`}>
                      <i /> {barber.active ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                  <p>{barber.title}</p>
                  <div className="team-contact">
                    <span>
                      <Mail size={13} /> {barber.email}
                    </span>
                    <span>
                      <Clock3 size={13} /> {barber.startTime} — {barber.endTime}
                    </span>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Editar ${barber.name}`}
                  type="button"
                  onClick={() => setEditingId(editing ? "" : barber.id)}
                >
                  <Edit3 size={16} />
                </button>
              </div>
              <div className="team-card-stats">
                <div>
                  <span>Atendimentos hoje</span>
                  <strong>{count}</strong>
                </div>
                <div>
                  <span>Recebido hoje</span>
                  <strong>{formatCurrency(revenue)}</strong>
                </div>
                <div>
                  <span>Dias de trabalho</span>
                  <strong>
                    {barber.workDays.length} dias <small>por semana</small>
                  </strong>
                </div>
                <button
                  className="team-share-link"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(
                        `${window.location.origin}/b/${workspace.settings.slug}/${barber.id}`,
                      )
                      .then(() => onNotify("Link do barbeiro copiado."));
                  }}
                  type="button"
                >
                  <Share2 size={15} /> Copiar link
                </button>
              </div>
              {editing && (
                <div className="team-edit-panel">
                  <div className="team-edit-head">
                    <div>
                      <strong>Disponibilidade de {barber.name.split(" ")[0]}</strong>
                      <span>Configure a jornada e a pausa deste barbeiro.</span>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setEditingId("")}
                      type="button"
                      aria-label="Fechar edição"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="settings-form-grid">
                    <label>
                      Início do dia
                      <input
                        type="time"
                        value={barber.startTime}
                        onChange={(event) =>
                          updateBarber(barber.id, { startTime: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fim do dia
                      <input
                        type="time"
                        value={barber.endTime}
                        onChange={(event) =>
                          updateBarber(barber.id, { endTime: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Início da pausa
                      <input
                        type="time"
                        value={barber.breakStart}
                        onChange={(event) =>
                          updateBarber(barber.id, { breakStart: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fim da pausa
                      <input
                        type="time"
                        value={barber.breakEnd}
                        onChange={(event) =>
                          updateBarber(barber.id, { breakEnd: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="workday-control">
                    <span>Dias ativos</span>
                    {[
                      [1, "SEG"],
                      [2, "TER"],
                      [3, "QUA"],
                      [4, "QUI"],
                      [5, "SEX"],
                      [6, "SÁB"],
                      [0, "DOM"],
                    ].map(([day, label]) => (
                      <button
                        key={day}
                        className={barber.workDays.includes(Number(day)) ? "active" : ""}
                        type="button"
                        onClick={() => {
                          const days = barber.workDays.includes(Number(day))
                            ? barber.workDays.filter((value) => value !== Number(day))
                            : [...barber.workDays, Number(day)];
                          updateBarber(barber.id, { workDays: days });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="barber-duration-list">
                    <strong>Serviços atendidos e duração</strong>
                    {workspace.services.map((service) => (
                      <label key={service.id}>
                        <span className="barber-service-enable">
                          <input
                            type="checkbox"
                            checked={barber.serviceIds.includes(service.id)}
                            disabled={!service.active}
                            onChange={(event) =>
                              updateBarber(barber.id, {
                                serviceIds: event.target.checked
                                  ? [...barber.serviceIds, service.id]
                                  : barber.serviceIds.filter((id) => id !== service.id),
                              })
                            }
                          />
                          {service.name}
                        </span>
                        <span>
                          <input
                            type="number"
                            min={15}
                            step={5}
                            value={barber.serviceDurations[service.id] ?? service.duration}
                            onChange={(event) =>
                              updateBarber(barber.id, {
                                serviceDurations: {
                                  ...barber.serviceDurations,
                                  [service.id]: Math.max(15, Number(event.target.value)),
                                },
                              })
                            }
                          />{" "}
                          min
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="text-button danger-text"
                    onClick={() => updateBarber(barber.id, { active: !barber.active })}
                    type="button"
                  >
                    {barber.active ? "Pausar barbeiro" : "Reativar barbeiro"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {addOpen && role === "owner" && (
        <Modal
          title="Adicionar barbeiro"
          description="Inclua um profissional na equipe desta barbearia."
          onClose={() => setAddOpen(false)}
        >
          <form className="modal-form" onSubmit={addBarber}>
            <label>
              Nome
              <input required name="name" placeholder="Ex.: Thiago Barros" />
            </label>
            <div className="modal-form-row">
              <label>
                E-mail
                <input type="email" name="email" placeholder="thiago@email.com" />
              </label>
              <label>
                WhatsApp
                <input inputMode="tel" name="phone" placeholder="(11) 99999-9999" />
              </label>
            </div>
            <div className="inline-notice">
              <Mail size={15} /> O convite de acesso por e-mail será ativado quando a autenticação
              estiver conectada.
            </div>
            <div className="modal-actions">
              <button className="button-quiet" type="button" onClick={() => setAddOpen(false)}>
                Cancelar
              </button>
              <button className="button-primary" type="submit">
                Adicionar à equipe <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ServicesPage({
  workspace,
  setWorkspace,
  role,
  onNotify,
}: {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  role: UserRole;
  onNotify: (message: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const canEdit = role === "owner";

  function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const service: Service = {
      id: `service-${Date.now().toString(36)}`,
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      price: Number(form.get("price") ?? 0),
      duration: Number(form.get("duration") ?? 30),
      category: String(form.get("category") ?? "Serviços"),
      active: true,
    };
    if (!service.name) return;
    setWorkspace({ ...workspace, services: [...workspace.services, service] });
    setAddOpen(false);
    onNotify("Serviço adicionado ao catálogo.");
  }

  function updateService(id: string, update: Partial<Service>) {
    setWorkspace({
      ...workspace,
      services: workspace.services.map((item) => (item.id === id ? { ...item, ...update } : item)),
    });
  }

  return (
    <>
      <PageTitle
        eyebrow="CARDÁPIO DA BARBEARIA"
        title="Serviços com identidade."
        description="O valor é compartilhado na loja; a duração pode variar por barbeiro."
      >
        {canEdit && (
          <button className="button-primary" onClick={() => setAddOpen(true)} type="button">
            <Plus size={16} /> Novo serviço
          </button>
        )}
      </PageTitle>
      {!canEdit && (
        <div className="inline-notice">
          <Eye size={16} /> Preços definidos pelo dono da barbearia. Você pode ajustar a duração na
          sua disponibilidade.
        </div>
      )}
      <div className="service-admin-list">
        {workspace.services.map((service) => (
          <article
            className={`service-admin-card ${!service.active ? "service-inactive" : ""}`}
            key={service.id}
          >
            <div className="service-admin-icon">
              <Scissors size={18} />
            </div>
            <div className="service-admin-copy">
              <span>{service.category.toUpperCase()}</span>
              <h2>{service.name}</h2>
              <p>{service.description}</p>
            </div>
            <div className="service-admin-duration">
              <Clock3 size={14} />
              <span>
                {service.duration} min <small>base</small>
              </span>
            </div>
            <div className="service-admin-price">
              <span>PREÇO DA LOJA</span>
              <strong>{formatCurrency(service.price)}</strong>
            </div>
            {canEdit && (
              <button
                className="icon-button"
                aria-label={`Editar ${service.name}`}
                type="button"
                onClick={() => setEditingId(editingId === service.id ? "" : service.id)}
              >
                <Edit3 size={15} />
              </button>
            )}
            {editingId === service.id && canEdit && (
              <div className="service-edit-row">
                <label>
                  Preço em reais
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={service.price}
                    onChange={(event) =>
                      updateService(service.id, { price: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Duração base
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={service.duration}
                    onChange={(event) =>
                      updateService(service.id, { duration: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={service.active}
                    onChange={(event) =>
                      updateService(service.id, { active: event.target.checked })
                    }
                  />{" "}
                  Serviço ativo
                </label>
                <button className="text-button" onClick={() => setEditingId("")} type="button">
                  Concluir <Check size={14} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="service-footnote">
        <CircleDollarSign size={15} /> Cada barbeiro pode definir sua própria duração. O preço do
        serviço permanece igual para toda a barbearia.
      </div>
      {addOpen && (
        <Modal
          title="Novo serviço"
          description="O novo valor será usado por toda a equipe."
          onClose={() => setAddOpen(false)}
        >
          <form className="modal-form" onSubmit={addService}>
            <label>
              Nome do serviço
              <input required name="name" placeholder="Ex.: Corte infantil" />
            </label>
            <label>
              Descrição
              <input name="description" placeholder="O que está incluído?" />
            </label>
            <div className="modal-form-row">
              <label>
                Preço (R$)
                <input required type="number" min={0} name="price" placeholder="55" />
              </label>
              <label>
                Duração base (min)
                <input required type="number" min={15} step={5} name="duration" placeholder="45" />
              </label>
            </div>
            <label>
              Categoria
              <input name="category" placeholder="Cabelo, barba, combo..." />
            </label>
            <div className="modal-actions">
              <button className="button-quiet" type="button" onClick={() => setAddOpen(false)}>
                Cancelar
              </button>
              <button className="button-primary" type="submit">
                Salvar serviço <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ProductsPage({
  workspace,
  setWorkspace,
  role,
  barberId,
  onNotify,
}: {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  role: UserRole;
  barberId: string;
  onNotify: (message: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [saleProduct, setSaleProduct] = useState("");
  const [saleBarber, setSaleBarber] = useState(barberId);
  const [saleQuantity, setSaleQuantity] = useState("1");
  const visibleSales = workspace.sales.filter(
    (item) => item.date === localDateKey() && (role === "owner" || item.barberId === barberId),
  );

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product: Product = {
      id: `product-${Date.now().toString(36)}`,
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      price: Number(form.get("price") ?? 0),
      category: String(form.get("category") ?? "Cuidados"),
      active: true,
    };
    if (!product.name) return;
    setWorkspace({ ...workspace, products: [...workspace.products, product] });
    setAddOpen(false);
    onNotify("Produto adicionado ao catálogo.");
  }

  function registerSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = workspace.products.find((item) => item.id === saleProduct);
    const barber = role === "barber" ? barberId : saleBarber || workspace.barbers[0]?.id;
    if (!product || !barber) return;
    const sale: ProductSale = {
      id: `sale-${Date.now().toString(36)}`,
      productId: product.id,
      barberId: barber,
      quantity: Math.max(1, Number(saleQuantity)),
      unitPrice: product.price,
      date: localDateKey(),
      paid: true,
    };
    setWorkspace({ ...workspace, sales: [...workspace.sales, sale] });
    onNotify("Venda de produto registrada no caixa.");
    setSaleProduct("");
    setSaleQuantity("1");
  }

  function setProductActive(product: Product, active: boolean) {
    setWorkspace({
      ...workspace,
      products: workspace.products.map((item) =>
        item.id === product.id ? { ...item, active } : item,
      ),
    });
  }

  return (
    <>
      <PageTitle
        eyebrow="VITRINE E CAIXA"
        title="Detalhes que continuam em casa."
        description="Mostre seus produtos e registre as vendas feitas no balcão."
      >
        {role === "owner" && (
          <button className="button-primary" onClick={() => setAddOpen(true)} type="button">
            <Plus size={16} /> Adicionar produto
          </button>
        )}
      </PageTitle>
      <section className="panel product-cash-panel">
        <div className="product-cash-copy">
          <span className="panel-kicker">VENDA MANUAL · SEM ESTOQUE AUTOMÁTICO</span>
          <h2>Registre o que saiu do balcão.</h2>
          <p>Vendas marcadas como pagas entram no faturamento do barbeiro e da loja.</p>
        </div>
        <form
          className={`sale-form ${role === "owner" ? "sale-form-owner" : ""}`}
          onSubmit={registerSale}
        >
          {role === "owner" && (
            <label>
              Barbeiro
              <select
                required
                value={saleBarber}
                onChange={(event) => setSaleBarber(event.target.value)}
              >
                {workspace.barbers
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Produto
            <select
              required
              value={saleProduct}
              onChange={(event) => setSaleProduct(event.target.value)}
            >
              <option value="">Escolha um produto</option>
              {workspace.products
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatCurrency(item.price)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Qtd.
            <input
              min={1}
              type="number"
              value={saleQuantity}
              onChange={(event) => setSaleQuantity(event.target.value)}
            />
          </label>
          <button className="button-primary" type="submit">
            <Plus size={15} /> Registrar venda
          </button>
        </form>
      </section>
      <div className="product-section-head">
        <div>
          <span className="panel-kicker">CATÁLOGO DA LOJA</span>
          <h2>Produtos em destaque</h2>
        </div>
        <span>{workspace.products.filter((item) => item.active).length} itens ativos</span>
      </div>
      <div className="product-grid">
        {workspace.products.map((product, index) => (
          <article
            className={`product-card ${!product.active ? "product-card-inactive" : ""}`}
            key={product.id}
          >
            <div className={`product-art product-art-${index % 3}`}>
              <div className="product-art-shadow" />
              <div className="product-bottle">
                <span>
                  {product.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 3)}
                </span>
              </div>
              <span className="product-category">{product.category}</span>
            </div>
            <div className="product-card-info">
              <div>
                <span>{product.category.toUpperCase()}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </div>
              <strong>{formatCurrency(product.price)}</strong>
            </div>
            {role === "owner" && (
              <button
                className="product-toggle"
                onClick={() => setProductActive(product, !product.active)}
                type="button"
              >
                {product.active ? "No catálogo" : "Oculto"}{" "}
                <span className={product.active ? "toggle-on" : ""} />
              </button>
            )}
          </article>
        ))}
      </div>
      <section className="panel recent-sales-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">MOVIMENTAÇÃO</span>
            <h2>{role === "owner" ? "Vendas registradas hoje" : "Suas vendas de hoje"}</h2>
          </div>
          <strong>
            {formatCurrency(
              visibleSales
                .filter((item) => item.paid)
                .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
            )}
          </strong>
        </div>
        <div className="sales-list">
          {visibleSales
            .slice(-5)
            .reverse()
            .map((sale) => {
              const product = workspace.products.find((item) => item.id === sale.productId);
              const barber = barberFor(workspace, sale.barberId);
              return (
                <div className="sales-row" key={sale.id}>
                  <span className="sales-icon">
                    <ShoppingBag size={15} />
                  </span>
                  <div>
                    <strong>{product?.name ?? "Produto removido"}</strong>
                    <small>
                      {sale.quantity} un. · {role === "owner" ? (barber?.name ?? "Equipe") : "Você"}
                    </small>
                  </div>
                  <strong>{formatCurrency(sale.unitPrice * sale.quantity)}</strong>
                  <span className="paid-pill">Pago</span>
                </div>
              );
            })}
        </div>
      </section>
      {addOpen && (
        <Modal
          title="Adicionar produto"
          description="Inclua um item na vitrine da sua barbearia."
          onClose={() => setAddOpen(false)}
        >
          <form className="modal-form" onSubmit={addProduct}>
            <label>
              Nome do produto
              <input required name="name" placeholder="Ex.: Pomada efeito natural" />
            </label>
            <label>
              Descrição
              <input name="description" placeholder="Benefício principal do produto" />
            </label>
            <div className="modal-form-row">
              <label>
                Preço (R$)
                <input required type="number" min={0} name="price" placeholder="49" />
              </label>
              <label>
                Categoria
                <input name="category" placeholder="Cabelo, barba..." />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button-quiet" type="button" onClick={() => setAddOpen(false)}>
                Cancelar
              </button>
              <button className="button-primary" type="submit">
                Salvar produto <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function SettingsPage({
  workspace,
  setWorkspace,
  onNotify,
}: {
  workspace: DemoWorkspace;
  setWorkspace: (workspace: DemoWorkspace) => void;
  onNotify: (message: string) => void;
}) {
  const { settings } = workspace;
  function updateSettings(update: Partial<DemoWorkspace["settings"]>) {
    setWorkspace({ ...workspace, settings: { ...settings, ...update } });
  }
  function handleLogoUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onNotify("Escolha um arquivo de imagem.");
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/webp", 0.78);
        if (compressed.length > 360_000) return onNotify("Esse logo ficou grande demais. Escolha uma imagem mais simples.");
        updateSettings({ logoUrl: compressed });
      };
      image.onerror = () => onNotify("Não foi possível ler essa imagem.");
      image.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  }
  return (
    <>
      <PageTitle
        eyebrow="SUA MARCA, SUA CASA"
        title="Configure sua barbearia."
        description="Ajuste a página pública, os contatos e as regras da agenda."
      />
      <div className="settings-layout">
        <section className="panel settings-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">IDENTIDADE DA LOJA</span>
              <h2>Como a barbearia aparece</h2>
            </div>
            <BrandMark settings={settings} />
          </div>
          <div className="settings-form-grid">
            <label>
              Nome público
              <input
                value={settings.name}
                onChange={(event) => updateSettings({ name: event.target.value })}
              />
            </label>
            <label>
              Link da loja
              <div className="settings-slug">
                <span>/b/</span>
                <input
                  value={settings.slug}
                  onChange={(event) =>
                    updateSettings({
                      slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
              </div>
            </label>
            <label>
              Iniciais do logo
              <input
                maxLength={2}
                value={settings.logoText}
                onChange={(event) => updateSettings({ logoText: event.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Imagem do logo (até 1 MB)
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleLogoUpload(event.target.files?.[0])}
              />
            </label>
            {settings.logoUrl && (
              <button
                className="text-button danger-text"
                onClick={() => updateSettings({ logoUrl: "" })}
                type="button"
              >
                Remover imagem do logo
              </button>
            )}
            <label>
              Endereço
              <input
                value={settings.address}
                onChange={(event) => updateSettings({ address: event.target.value })}
              />
            </label>
          </div>
          <div className="accent-picker">
            <span>Cor de destaque</span>
            <div>
              {ACCENT_OPTIONS.map((accent) => (
                <button
                  key={accent.value}
                  aria-label={accent.name}
                  className={settings.accent === accent.value ? "active" : ""}
                  style={{ backgroundColor: accent.value }}
                  onClick={() => updateSettings({ accent: accent.value })}
                  type="button"
                />
              ))}
              <label className="custom-color-option" title="Escolher outra cor">
                <input
                  aria-label="Escolher outra cor de destaque"
                  type="color"
                  value={settings.accent}
                  onChange={(event) => updateSettings({ accent: event.target.value })}
                />
                <span>+</span>
              </label>
            </div>
            <small>Escolha entre as cores prontas ou selecione qualquer cor para combinar com sua marca.</small>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">CONTATOS</span>
              <h2>Onde os clientes encontram você</h2>
            </div>
            <Link2 size={18} />
          </div>
          <div className="settings-form-grid">
            <label>
              Receber avisos de agendamentos neste e-mail
              <input
                type="email"
                required
                value={settings.email}
                onChange={(event) => updateSettings({ email: event.target.value })}
              />
            </label>
            <p className="email-setup-note">O cliente também recebe a confirmação. Informe o endereço que deve receber os avisos de novos agendamentos.</p>
            <label>
              WhatsApp da loja
              <input
                inputMode="tel"
                value={settings.phone}
                onChange={(event) =>
                  updateSettings({ phone: event.target.value.replace(/\D/g, "") })
                }
              />
            </label>
            <label>
              Abre às
              <input
                type="time"
                value={settings.openTime}
                onChange={(event) => updateSettings({ openTime: event.target.value })}
              />
            </label>
            <label>
              Fecha às
              <input
                type="time"
                value={settings.closeTime}
                onChange={(event) => updateSettings({ closeTime: event.target.value })}
              />
            </label>
            <label>
              Fuso horário
              <select
                value={settings.timezone}
                onChange={(event) => updateSettings({ timezone: event.target.value })}
              >
                <option value="America/Sao_Paulo">Brasília · America/Sao_Paulo</option>
                <option value="America/Manaus">Manaus · America/Manaus</option>
                <option value="America/Rio_Branco">Rio Branco · America/Rio_Branco</option>
              </select>
            </label>
            <label>
              Prazo para cancelar
              <input
                type="number"
                min={0}
                max={72}
                value={settings.cancellationHours}
                onChange={(event) =>
                  updateSettings({ cancellationHours: Number(event.target.value) })
                }
              />
              <small>Horas antes do agendamento</small>
            </label>
          </div>
        </section>
        <section className="panel settings-card settings-wide">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">NOTIFICAÇÕES</span>
              <h2>Avise a equipe sobre novos horários</h2>
            </div>
            <Bell size={18} />
          </div>
          <div className="settings-note">
            <Bell size={15} /> O envio por Gmail está conectado. Cada agendamento envia um aviso
            para este e-mail e uma confirmação para o endereço informado pelo cliente.
          </div>
        </section>
      </div>
      <div className="settings-save-row">
        <span>
          <CheckCircle2 size={15} />
          {import.meta.env.DEV
            ? "Alterações salvas automaticamente neste navegador."
            : "Alterações sincronizadas com a nuvem."}
        </span>
        <button
          className="button-primary"
          onClick={() => onNotify("Configurações salvas neste navegador.")}
          type="button"
        >
          Salvar configuração
        </button>
      </div>
    </>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <div>
            <span className="panel-kicker">PAINEL DA BARBEARIA</span>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ProsperousApp() {
  const { workspace, setWorkspace, resetDemo, ready } = useDemoWorkspace();
  const { toast, notify } = useToast();
  const [authLoaded, setAuthLoaded] = useState(import.meta.env.DEV);
  const [authenticated, setAuthenticated] = useState(import.meta.env.DEV);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShopSlug, setLoginShopSlug] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("shop") ?? "",
  );
  const [authError, setAuthError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );
  const soundContext = useRef<AudioContext | null>(null);
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [role, setRole] = useState<UserRole>("owner");
  const [barberId, setBarberId] = useState(workspace.barbers[0]?.id ?? "rafael");
  const [period, setPeriod] = useState<Period>("day");
  const [mobileNav, setMobileNav] = useState(false);
  const today = localDateKey();
  const barber = useMemo(() => barberFor(workspace, barberId), [workspace, barberId]);
  const visibleNotifications = workspace.notifications.filter((item) => {
    if (role === "owner") return true;
    return workspace.appointments.some(
      (appointment) => appointment.id === item.appointmentId && appointment.barberId === barberId,
    );
  });
  const unreadNotifications = visibleNotifications.filter((item) => !item.read);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then((result: { authenticated?: boolean; role?: string }) => {
        if (cancelled) return;
        setAuthenticated(Boolean(result.authenticated && result.role === "shop"));
        setAuthLoaded(true);
        if (result.authenticated && result.role === "shop") window.dispatchEvent(new Event("workspace:refresh"));
      })
      .catch(() => {
        if (!cancelled) setAuthLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const existingIds = new Set(workspace.notifications.map((item) => item.id));
    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = existingIds;
      return;
    }
    const fresh = workspace.notifications.filter(
      (item) => !item.read && !seenNotificationIds.current?.has(item.id),
    );
    seenNotificationIds.current = existingIds;
    if (role !== "owner" || fresh.length === 0) return;

    const newest = fresh[0];
    const appointment = workspace.appointments.find((item) => item.id === newest?.appointmentId);
    if (!appointment) return;
    const service = serviceFor(workspace, appointment.serviceId);
    const barber = barberFor(workspace, appointment.barberId);
    const title = `Novo agendamento · ${appointment.clientName}`;
    const details = `${appointment.time} · ${service?.name ?? "Serviço"} · ${barber?.name ?? "Barbeiro"}`;
    notifyRef.current(`${title}: ${details}`);
    if (soundEnabled && soundContext.current) playRegisterSound(soundContext.current);
    if (browserNotificationsEnabled && "Notification" in window) {
      new Notification(title, { body: details, icon: "/favicon.ico" });
    }
  }, [workspace.notifications, workspace.appointments, workspace.services, workspace.barbers, ready, role, soundEnabled, browserNotificationsEnabled]);

  async function toggleNotificationSound() {
    if (soundEnabled) {
      await soundContext.current?.close();
      soundContext.current = null;
      setSoundEnabled(false);
      return;
    }
    if (typeof window.AudioContext === "undefined") {
      notify("Este navegador não oferece aviso sonoro.");
      return;
    }
    const context = new AudioContext();
    await context.resume();
    soundContext.current = context;
    setSoundEnabled(true);
    playRegisterSound(context);
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) {
      notify("Este navegador não oferece notificações do sistema.");
      return;
    }
    const permission = await Notification.requestPermission();
    setBrowserNotificationsEnabled(permission === "granted");
    notify(permission === "granted" ? "Avisos do navegador ativados." : "Permissão não concedida.");
  }

  function markNotificationsRead() {
    const visibleIds = new Set(visibleNotifications.map((item) => item.id));
    setWorkspace({
      ...workspace,
      notifications: workspace.notifications.map((item) =>
        visibleIds.has(item.id) ? { ...item, read: true } : item,
      ),
    });
  }
  const visibleScreens: Screen[] =
    role === "owner"
      ? ["dashboard", "agenda", "team", "services", "products", "settings"]
      : ["dashboard", "agenda", "team", "services", "products"];

  function markPaid(appointment: Appointment) {
    setWorkspace({
      ...workspace,
      appointments: workspace.appointments.map((item) =>
        item.id === appointment.id ? { ...item, paid: !item.paid } : item,
      ),
    });
    notify(
      appointment.paid ? "Pagamento removido do registro." : "Pagamento marcado como recebido.",
    );
  }

  function setStatus(appointment: Appointment, status: BookingStatus) {
    setWorkspace({
      ...workspace,
      appointments: workspace.appointments.map((item) =>
        item.id === appointment.id ? { ...item, status } : item,
      ),
    });
    notify("Status do atendimento atualizado.");
  }

  function navigate(next: Screen) {
    setScreen(next);
    setMobileNav(false);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/tenant/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: loginShopSlug, password: loginPassword }),
      });
      const result = (await response.json()) as { error?: string; authenticated?: boolean };
      if (!response.ok || !result.authenticated) {
        setAuthError(result.error ?? "Não foi possível entrar no painel.");
        return;
      }
      setAuthenticated(true);
      setLoginPassword("");
      window.dispatchEvent(new Event("workspace:refresh"));
    } catch {
      setAuthError("Não foi possível conectar ao servidor. Tente novamente.");
    }
  }

  if (!authLoaded && !import.meta.env.DEV) {
    return <main className="admin-login"><p>Verificando acesso ao painel…</p></main>;
  }

  if (!authenticated && !import.meta.env.DEV) {
    return (
      <main className="admin-login">
        <form className="admin-login-card" onSubmit={submitLogin}>
          <span className="panel-kicker">PAINEL DA BARBEARIA</span>
          <h1>Entre para gerenciar sua agenda.</h1>
          <p>Use o identificador da sua barbearia e a senha recebida na ativação.</p>
          <label>
            Identificador da barbearia
            <input
              autoComplete="username"
              required
              value={loginShopSlug}
              onChange={(event) => setLoginShopSlug(event.target.value)}
              placeholder="ex.: barbearia-central"
            />
          </label>
          <label>
            Senha do painel
            <input
              autoComplete="current-password"
              type="password"
              required
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
          </label>
          {authError && <p className="admin-login-error" role="alert">{authError}</p>}
          <button className="button-primary" type="submit">Acessar painel</button>
        </form>
      </main>
    );
  }

  if (screen === "booking")
    return (
      <BookingFlow
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        {...(role === "barber" ? { initialBarberId: barberId } : {})}
        onBack={() => navigate("dashboard")}
        publicUrl={`/b/${workspace.settings.slug}`}
      />
    );

  const menu: { id: Screen; label: string; icon: ReactNode; group?: string }[] = [
    { id: "dashboard", label: "Visão geral", icon: <LayoutDashboard size={17} /> },
    { id: "agenda", label: "Agenda", icon: <CalendarDays size={17} /> },
    {
      id: "team",
      label: role === "owner" ? "Equipe" : "Disponibilidade",
      icon: <Users size={17} />,
      group: "GESTÃO",
    },
    { id: "services", label: "Serviços", icon: <Scissors size={17} /> },
    { id: "products", label: "Produtos", icon: <Package size={17} /> },
    {
      id: "settings",
      label: "Configurações",
      icon: <Settings2 size={17} />,
      group: "PREFERÊNCIAS",
    },
  ];

  return (
    <div
      className="app-shell"
      style={{ "--shop-accent": workspace.settings.accent } as CSSProperties}
    >
      <aside className={`app-sidebar ${mobileNav ? "app-sidebar-open" : ""}`}>
        <a
          className="app-brand"
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            navigate("dashboard");
          }}
        >
          <BrandMark settings={workspace.settings} />
          <span>
            <strong>{workspace.settings.name}</strong>
            <small>BARBEARIA</small>
          </span>
        </a>
        <div className="shop-switcher">
          <span className="shop-switcher-mark">
            {workspace.settings.logoUrl ? (
              <img src={workspace.settings.logoUrl} alt="" />
            ) : (
              workspace.settings.logoText
            )}
          </span>
          <span>
            <strong>{workspace.settings.name}</strong>
            <small>{import.meta.env.DEV ? "Plano demonstração" : "Plano inicial"}</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {menu
            .filter((item) => visibleScreens.includes(item.id))
            .map((item) => (
              <div key={item.id}>
                {item.group && <div className="sidebar-group-label">{item.group}</div>}
                <button
                  className={screen === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                  type="button"
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === "agenda" && (
                    <i className="nav-count">
                      {
                        workspace.appointments.filter(
                          (appointment) =>
                            appointment.date === today && appointment.status === "confirmed",
                        ).length
                      }
                    </i>
                  )}
                </button>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Activity size={16} />
            </div>
            <div>
              <strong>Uma agenda mais leve.</strong>
              <span>Seu espaço, do seu jeito.</span>
            </div>
          </div>
          <div className="sidebar-profile">
            <Avatar barber={role === "owner" ? workspace.barbers[0] : barber} />
            <div>
              <strong>{role === "owner" ? workspace.settings.ownerName : barber?.name}</strong>
              <span>{role === "owner" ? "Proprietário" : "Barbeiro"}</span>
            </div>
            <button className="icon-button" aria-label="Opções de perfil" type="button">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileNav(false)}
          type="button"
        />
      )}
      <div className="app-main" id="top">
        <header className="app-topbar">
          <button
            className="mobile-menu-button"
            aria-label="Abrir menu"
            onClick={() => setMobileNav(true)}
            type="button"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>{workspace.settings.name}</span>
            <ChevronRight size={14} />
            <strong>{screenLabels[screen]}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-indicator">
              <i /> {import.meta.env.DEV ? "DEMONSTRAÇÃO" : "MVP ATIVO"}
            </span>
            <div className="notification-menu-wrap">
              <button
                className="icon-button topbar-bell"
                aria-label={`Notificações${unreadNotifications.length ? `, ${unreadNotifications.length} novas` : ""}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
                type="button"
              >
                <Bell size={18} />
                {unreadNotifications.length > 0 && (
                  <span className="notification-unread-count">
                    {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section className="notification-panel" aria-label="Notificações de agendamento">
                  <div className="notification-panel-head">
                    <div>
                      <strong>Agendamentos</strong>
                      <span>{unreadNotifications.length} não lidos</span>
                    </div>
                    {unreadNotifications.length > 0 && (
                      <button className="text-button" onClick={markNotificationsRead} type="button">
                        Marcar lidos
                      </button>
                    )}
                  </div>
                  <div className="notification-controls">
                    <button onClick={() => void toggleNotificationSound()} type="button">
                      {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      {soundEnabled ? "Som ligado" : "Ativar som"}
                    </button>
                    <button onClick={() => void enableBrowserNotifications()} type="button">
                      <Bell size={14} />
                      {browserNotificationsEnabled ? "Avisos do navegador ligados" : "Avisos do navegador"}
                    </button>
                  </div>
                  {visibleNotifications.length === 0 ? (
                    <div className="notification-empty">
                      <CalendarDays size={18} />
                      <span>Nenhum agendamento novo por enquanto.</span>
                    </div>
                  ) : (
                    <div className="notification-list">
                      {visibleNotifications.slice(0, 8).map((item) => {
                        const appointment = workspace.appointments.find(
                          (entry) => entry.id === item.appointmentId,
                        );
                        if (!appointment) return null;
                        const service = serviceFor(workspace, appointment.serviceId);
                        const assignedBarber = barberFor(workspace, appointment.barberId);
                        return (
                          <button
                            className={`notification-row ${item.read ? "" : "unread"}`}
                            key={item.id}
                            onClick={() => {
                              setWorkspace({
                                ...workspace,
                                notifications: workspace.notifications.map((entry) =>
                                  entry.id === item.id ? { ...entry, read: true } : entry,
                                ),
                              });
                              setNotificationsOpen(false);
                              navigate("agenda");
                            }}
                            type="button"
                          >
                            <span className="notification-dot" />
                            <span className="notification-copy">
                              <strong>Novo agendamento · {appointment.clientName}</strong>
                              <small>
                                {formatFullDate(appointment.date)} · {appointment.time} · {service?.name}
                              </small>
                              <small>Barbeiro: {assignedBarber?.name}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
            <div className="role-switch">
              <span>Ver como</span>
              <select
                aria-label="Alternar papel de demonstração"
                value={role === "owner" ? "owner" : barberId}
                onChange={(event) => {
                  if (event.target.value === "owner") {
                    setRole("owner");
                  } else {
                    setRole("barber");
                    setBarberId(event.target.value);
                  }
                }}
              >
                <option value="owner">Dono · {workspace.settings.ownerName.split(" ")[0]}</option>
                {workspace.barbers.map((item) => (
                  <option value={item.id} key={item.id}>
                    Barbeiro · {item.name.split(" ")[0]}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
        </header>
        <main className="app-content">
          {import.meta.env.DEV && <div className="demo-banner">
            <span className="demo-banner-icon">
              <Eye size={15} />
            </span>
            <div>
              <strong>Modo demonstração</strong>
              <span>
                Personalização, equipe e agenda ficam salvas neste navegador nesta demonstração.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                resetDemo();
                notify("Demonstração restaurada com os dados iniciais.");
              }}
            >
              <RotateCcw size={14} /> Restaurar
            </button>
          </div>}
          {screen === "dashboard" && (
            <Dashboard
              workspace={workspace}
              role={role}
              barberId={barberId}
              period={period}
              setPeriod={setPeriod}
              today={today}
              onNavigate={navigate}
              onMarkPaid={markPaid}
              onSetStatus={setStatus}
            />
          )}
          {screen === "agenda" && (
            <AgendaPage
              workspace={workspace}
              setWorkspace={setWorkspace}
              role={role}
              barberId={barberId}
              today={today}
              onNewAppointment={() => navigate("booking")}
              onNotify={notify}
            />
          )}
          {screen === "team" && (
            <TeamPage
              workspace={workspace}
              setWorkspace={setWorkspace}
              role={role}
              barberId={barberId}
              onNotify={notify}
            />
          )}
          {screen === "services" && (
            <ServicesPage
              workspace={workspace}
              setWorkspace={setWorkspace}
              role={role}
              onNotify={notify}
            />
          )}
          {screen === "products" && (
            <ProductsPage
              workspace={workspace}
              setWorkspace={setWorkspace}
              role={role}
              barberId={barberId}
              onNotify={notify}
            />
          )}
          {screen === "settings" && role === "owner" && (
            <SettingsPage workspace={workspace} setWorkspace={setWorkspace} onNotify={notify} />
          )}
          <footer className="app-footer">
            <span>© 2026 {workspace.settings.name}</span>
            <span>Feito para deixar o tempo trabalhar a seu favor.</span>
            <a href={`/b/${workspace.settings.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Página pública
            </a>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
        {(["dashboard", "agenda", "team", "products"] as Screen[])
          .filter((item) => visibleScreens.includes(item))
          .map((item) => (
            <button
              className={screen === item ? "active" : ""}
              key={item}
              onClick={() => navigate(item)}
              type="button"
            >
              {item === "dashboard" ? (
                <LayoutDashboard size={18} />
              ) : item === "agenda" ? (
                <CalendarDays size={18} />
              ) : item === "team" ? (
                <Users size={18} />
              ) : (
                <Package size={18} />
              )}
              <span>
                {
                  {
                    dashboard: "Início",
                    agenda: "Agenda",
                    team: role === "owner" ? "Equipe" : "Horários",
                    services: "Serviços",
                    products: "Produtos",
                    settings: "Mais",
                    booking: "Agendar",
                  }[item]
                }
              </span>
            </button>
          ))}
        {role === "owner" && (
          <button
            className={screen === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
            type="button"
          >
            <Settings2 size={18} />
            <span>Mais</span>
          </button>
        )}
      </nav>
      {toast && (
        <div className="toast-message" role="status">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
      {!ready && (
        <div className="demo-load-indicator" aria-live="polite">
          Carregando a demonstração…
        </div>
      )}
    </div>
  );
}
