import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";

import {
  createBooking,
  demoDateOffset,
  formatCurrency,
  getAvailableSlots,
  type Appointment,
  type Barber,
  type DemoWorkspace,
  type Service,
} from "@/lib/barbershop-demo";

type BookingStep = "service" | "barber" | "time" | "details" | "confirmed";

type BookingFlowProps = {
  workspace: DemoWorkspace;
  onWorkspaceChange: (workspace: DemoWorkspace) => void;
  initialBarberId?: string;
  onBack?: () => void;
  publicUrl?: string;
};

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function dayName(date: string, style: "short" | "long" = "short") {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
}

function dayNumber(date: string) {
  return Number(date.slice(-2));
}

function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function BookingFlow({
  workspace,
  onWorkspaceChange,
  initialBarberId,
  onBack,
  publicUrl,
}: BookingFlowProps) {
  const [step, setStep] = useState<BookingStep>(initialBarberId ? "service" : "service");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState(initialBarberId ?? "");
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Appointment | null>(null);

  const service = workspace.services.find((item) => item.id === serviceId);
  const barber = workspace.barbers.find((item) => item.id === barberId);
  const availableServices = workspace.services.filter(
    (item) => item.active && (!barber || barber.serviceIds.includes(item.id)),
  );
  const activeBarbers = useMemo(
    () => workspace.barbers.filter((item) => item.active),
    [workspace.barbers],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => demoDateOffset(todayKey(), index)),
    [],
  );
  const slots = barber && service ? getAvailableSlots(workspace, barber, service, date) : [];

  const progress =
    step === "confirmed" ? 4 : ({ service: 1, barber: 2, time: 3, details: 4 } as const)[step];

  function continueFromService() {
    if (!service) return setError("Escolha um serviço para continuar.");
    setError("");
    setStep(initialBarberId ? "time" : "barber");
  }

  function continueFromBarber() {
    if (!barber) return setError("Escolha um barbeiro para continuar.");
    setError("");
    setStep("time");
  }

  function continueFromTime() {
    if (!time) return setError("Escolha um horário disponível.");
    setError("");
    setStep("details");
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !barber || !time) return;
    const result = createBooking(workspace, {
      date,
      time,
      barberId: barber.id,
      serviceId: service.id,
      clientName: name.trim(),
      clientPhone: phone.replace(/\D/g, ""),
      clientEmail: email.trim(),
      duration: barber.serviceDurations[service.id] ?? service.duration,
      price: service.price,
    });
    if (result.error || !result.appointment) {
      setError("Esse horário acabou de ser reservado. Escolha outro horário disponível.");
      setStep("time");
      setTime("");
      return;
    }
    setError("");
    onWorkspaceChange(result.workspace);
    setBooking(result.appointment);
    setStep("confirmed");
  }

  function cancelDemoBooking() {
    if (!booking) return;
    onWorkspaceChange({
      ...workspace,
      appointments: workspace.appointments.map((item) =>
        item.id === booking.id ? { ...item, status: "canceled" } : item,
      ),
    });
    setBooking({ ...booking, status: "canceled" });
  }

  const heading =
    step === "confirmed"
      ? "Horário reservado"
      : step === "service"
        ? "Escolha o serviço"
        : step === "barber"
          ? "Escolha o barbeiro"
          : step === "time"
            ? "Escolha o dia e horário"
            : "Seus dados";

  return (
    <main
      className="booking-page"
      style={{ "--shop-accent": workspace.settings.accent } as React.CSSProperties}
    >
      <div className="booking-topline">
        {onBack ? (
          <button className="booking-back" onClick={onBack} type="button">
            <ArrowLeft size={17} /> Voltar ao painel
          </button>
        ) : (
          <a className="booking-back" href="/">
            <ArrowLeft size={17} /> {workspace.settings.name}
          </a>
        )}
        <span className="booking-demo-tag">
          <span /> Demonstração
        </span>
      </div>

      <div className="booking-layout">
        <section className="booking-main">
          <div className="booking-brand">
            <span className="booking-logo">
              {workspace.settings.logoUrl ? (
                <img
                  src={workspace.settings.logoUrl}
                  alt={`Logotipo de ${workspace.settings.name}`}
                />
              ) : (
                workspace.settings.logoText || "P"
              )}
            </span>
            <div>
              <strong>{workspace.settings.name}</strong>
              <span>
                <MapPin size={13} /> {workspace.settings.address}
              </span>
            </div>
          </div>

          {step !== "confirmed" && (
            <div className="booking-intro">
              <div className="eyebrow">AGENDA QUE OCUPA A CADEIRA</div>
              <h1>
                Seu próximo corte começa <em>aqui.</em>
              </h1>
              <p>Escolha seu serviço, seu barbeiro e um horário que funciona para você.</p>
            </div>
          )}

          {step !== "confirmed" && (
            <div className="booking-progress" aria-label={`Etapa ${progress} de 4`}>
              {[1, 2, 3, 4].map((item) => (
                <span key={item} className={item <= progress ? "booking-progress-active" : ""} />
              ))}
              <span className="booking-step-label">ETAPA {progress} DE 4</span>
            </div>
          )}

          <div className="booking-section-head">
            <div>
              <span className="booking-step-no">0{Math.min(progress, 4)}</span>
              <h2>{heading}</h2>
            </div>
            {step !== "confirmed" && <span className="booking-change-note">Sem compromisso</span>}
          </div>

          {step === "service" && (
            <>
              <div className="booking-service-list">
                {availableServices.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`service-choice ${serviceId === item.id ? "selected" : ""}`}
                    onClick={() => {
                      setServiceId(item.id);
                      setError("");
                    }}
                  >
                    <span className="service-choice-icon">
                      <Scissors size={17} />
                    </span>
                    <span className="service-choice-copy">
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                      <span>
                        <Clock3 size={13} /> {item.duration} min
                      </span>
                    </span>
                    <strong className="service-choice-price">{formatCurrency(item.price)}</strong>
                  </button>
                ))}
              </div>
              <div className="booking-actions">
                <span>O preço é definido pela barbearia.</span>
                <button className="button-primary" onClick={continueFromService} type="button">
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === "barber" && (
            <>
              <div className="booking-barber-list">
                {activeBarbers
                  .filter((item) => !service || item.serviceIds.includes(service.id))
                  .map((item) => (
                    <button
                      type="button"
                      className={`barber-choice ${barberId === item.id ? "selected" : ""}`}
                      onClick={() => {
                        setBarberId(item.id);
                        setError("");
                      }}
                      key={item.id}
                    >
                      <span
                        className="barber-avatar"
                        style={{ "--avatar-color": item.color } as React.CSSProperties}
                      >
                        {item.initials}
                      </span>
                      <span className="barber-choice-copy">
                        <strong>{item.name}</strong>
                        <small>{item.title}</small>
                      </span>
                      <span className="barber-choice-check">
                        {barberId === item.id && <Check size={14} />}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="booking-actions">
                <button className="button-quiet" onClick={() => setStep("service")} type="button">
                  <ArrowLeft size={15} /> Voltar
                </button>
                <button className="button-primary" onClick={continueFromBarber} type="button">
                  Ver horários <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === "time" && (
            <>
              <div className="booking-summary-strip">
                <span>{service?.name}</span>
                <span>·</span>
                <span>{barber?.name}</span>
                <button
                  type="button"
                  onClick={() => setStep(initialBarberId ? "service" : "barber")}
                >
                  Alterar
                </button>
              </div>
              <div className="booking-day-strip">
                {days.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setDate(day);
                      setTime("");
                      setError("");
                    }}
                    className={`booking-day ${date === day ? "selected" : ""}`}
                  >
                    <small>
                      {index === 0 ? "HOJE" : dayName(day).replace(".", "").toUpperCase()}
                    </small>
                    <strong>{dayNumber(day)}</strong>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", { month: "short" })
                        .format(new Date(`${day}T12:00:00`))
                        .replace(".", "")}
                    </small>
                  </button>
                ))}
              </div>
              <div className="booking-selected-date">
                {dayName(date, "long")}, {date.split("-").reverse().join("/")}
              </div>
              {slots.length > 0 ? (
                <div className="booking-slot-grid">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={time === slot ? "selected" : ""}
                      onClick={() => {
                        setTime(slot);
                        setError("");
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="booking-no-slots">
                  <Clock3 size={18} />
                  <strong>Sem horários disponíveis neste dia.</strong>
                  <span>Escolha outra data ou barbeiro.</span>
                </div>
              )}
              <div className="booking-actions">
                <button
                  className="button-quiet"
                  onClick={() => setStep(initialBarberId ? "service" : "barber")}
                  type="button"
                >
                  <ArrowLeft size={15} /> Voltar
                </button>
                <button className="button-primary" onClick={continueFromTime} type="button">
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === "details" && (
            <>
              <div className="booking-summary-card">
                <div>
                  <span>SEU HORÁRIO</span>
                  <strong>
                    {time} · {dayName(date, "long")}, {date.split("-").reverse().join("/")}
                  </strong>
                  <small>
                    {barber?.name} · {service?.name}
                  </small>
                </div>
                <strong>{formatCurrency(service?.price ?? 0)}</strong>
              </div>
              <form className="booking-form" onSubmit={submitBooking}>
                <label>
                  Seu nome
                  <input
                    required
                    minLength={2}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Como podemos te chamar?"
                  />
                </label>
                <div className="booking-form-row">
                  <label>
                    WhatsApp
                    <input
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="voce@email.com"
                    />
                  </label>
                </div>
                <p className="booking-privacy">
                  <ShieldCheck size={15} /> Seus dados são usados para confirmar e gerenciar este
                  agendamento.
                </p>
                <div className="booking-actions">
                  <button className="button-quiet" onClick={() => setStep("time")} type="button">
                    <ArrowLeft size={15} /> Voltar
                  </button>
                  <button className="button-primary" type="submit">
                    Confirmar horário <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "confirmed" && booking && (
            <div className="booking-confirmed">
              <div
                className={`booking-confirmed-check ${booking.status === "canceled" ? "is-canceled" : ""}`}
              >
                {booking.status === "canceled" ? <span>×</span> : <Check size={24} />}
              </div>
              <div className="eyebrow">
                {booking.status === "canceled" ? "HORÁRIO LIBERADO" : "AGENDAMENTO CONFIRMADO"}
              </div>
              <h2>
                {booking.status === "canceled"
                  ? "Agendamento cancelado."
                  : `Até lá, ${booking.clientName.split(" ")[0]}.`}
              </h2>
              <p>
                {booking.status === "canceled"
                  ? "O horário voltou a ficar disponível para outras pessoas."
                  : "Seu horário já está reservado nesta demonstração. Confira os detalhes abaixo."}
              </p>
              <div className="booking-confirmation-details">
                <div>
                  <span>DATA E HORA</span>
                  <strong>
                    {date.split("-").reverse().join("/")} · {time}
                  </strong>
                </div>
                <div>
                  <span>SERVIÇO</span>
                  <strong>{service?.name}</strong>
                </div>
                <div>
                  <span>BARBEIRO</span>
                  <strong>{barber?.name}</strong>
                </div>
                <div>
                  <span>VALOR</span>
                  <strong>{formatCurrency(service?.price ?? 0)}</strong>
                </div>
              </div>
              <div className="booking-confirm-actions">
                <a
                  className="button-primary"
                  target="_blank"
                  rel="noreferrer"
                  href={whatsappLink(
                    barber?.phone ?? workspace.settings.phone,
                    `Olá! Acabei de ${booking.status === "canceled" ? "cancelar" : "agendar"} ${service?.name} para ${date.split("-").reverse().join("/")} às ${time}.`,
                  )}
                >
                  <MessageCircle size={16} /> Falar pelo WhatsApp
                </a>
                {booking.status === "confirmed" ? (
                  <button className="button-quiet" onClick={cancelDemoBooking} type="button">
                    Cancelar reserva (demonstração)
                  </button>
                ) : (
                  <button
                    className="button-quiet"
                    onClick={() => {
                      setBooking(null);
                      setStep("service");
                      setTime("");
                    }}
                    type="button"
                  >
                    Fazer outro agendamento
                  </button>
                )}
              </div>
              {publicUrl && (
                <a className="booking-link-copy" href={publicUrl}>
                  Abrir página compartilhável da barbearia <ArrowRight size={15} />
                </a>
              )}
            </div>
          )}

          {error && step !== "confirmed" && (
            <div className="booking-error" role="alert">
              {error}
            </div>
          )}
          <div className="booking-footer-note">
            Atendimento feito com cuidado. <span>{workspace.settings.name}</span>
          </div>
          {workspace.products.some((product) => product.active) && (
            <section className="booking-product-catalog" aria-labelledby="booking-products-title">
              <div className="eyebrow">CUIDADOS DA CASA</div>
              <h2 id="booking-products-title">Leve o cuidado com você.</h2>
              <div className="booking-product-list">
                {workspace.products
                  .filter((product) => product.active)
                  .map((product) => (
                    <article key={product.id}>
                      <span>
                        <ShoppingBag size={15} />
                      </span>
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.description}</small>
                      </div>
                      <b>{formatCurrency(product.price)}</b>
                    </article>
                  ))}
              </div>
              <p>Consulte a disponibilidade e compre diretamente na barbearia.</p>
            </section>
          )}
        </section>

        <aside className="booking-aside">
          <div className="booking-aside-photo">
            <div className="booking-photo-mark">P.</div>
            <span>EST. 2018 · SÃO PAULO</span>
          </div>
          <div className="booking-aside-content">
            <span className="eyebrow">UM BOM CORTE MUDA O DIA</span>
            <h2>
              Precisão no corte.
              <br />
              <em>Respeito ao seu tempo.</em>
            </h2>
            <p>Uma experiência sem pressa, com atenção em cada detalhe.</p>
            <div className="booking-aside-stat">
              <span>
                <UserRound size={17} /> Barbeiros da casa
              </span>
              <strong>
                {activeBarbers.length}
                <small> especialistas</small>
              </strong>
            </div>
            <div className="booking-aside-stat">
              <span>
                <Clock3 size={17} /> Atendimento
              </span>
              <strong>
                {workspace.settings.openTime}
                <small> — {workspace.settings.closeTime}</small>
              </strong>
            </div>
            <a
              className="booking-aside-whatsapp"
              target="_blank"
              rel="noreferrer"
              href={whatsappLink(
                workspace.settings.phone,
                "Olá! Quero tirar uma dúvida sobre um agendamento.",
              )}
            >
              <MessageCircle size={16} /> Dúvidas? Chame a gente
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
