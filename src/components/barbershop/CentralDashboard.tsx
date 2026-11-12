import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, LogOut, Plus, Scissors, Send, Users } from "lucide-react";

type Client = {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: "demo" | "active" | "paused";
  created_at: string;
  demoUrl: string;
  panelUrl: string;
  billing: { plan: "monthly" | "yearly"; checkoutUrl?: string; status: "pending" | "active" | "paused" } | null;
};

const statusLabel: Record<Client["status"], string> = {
  demo: "Em demonstração",
  active: "Ativa",
  paused: "Pausada",
};

export function CentralDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [resetPassword, setResetPassword] = useState<{ clientId: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState("");

  async function loadClients() {
    const response = await fetch("/api/central/clients");
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const result = (await response.json()) as { clients?: Client[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar a central.");
    setClients(result.clients ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then(async (session: { authenticated?: boolean; role?: string }) => {
        if (cancelled) return;
        if (session.authenticated && session.role === "central") {
          setAuthenticated(true);
          await loadClients();
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeCount = useMemo(() => clients.filter((client) => client.status === "active").length, [clients]);
  const demoCount = useMemo(() => clients.filter((client) => client.status === "demo").length, [clients]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
    });
    const result = (await response.json()) as { authenticated?: boolean; error?: string };
    if (!response.ok || !result.authenticated) { setError(result.error ?? "Não foi possível entrar."); return; }
    setAuthenticated(true);
    setPassword("");
    await loadClients();
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/central/clients", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, phone }),
      });
      const result = (await response.json()) as { client?: Client; initialPassword?: string; error?: string };
      if (!response.ok || !result.client) throw new Error(result.error ?? "Não foi possível cadastrar a barbearia.");
      setInitialPassword(result.initialPassword ?? "");
      setName(""); setEmail(""); setPhone("");
      await loadClients();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao cadastrar.");
    } finally { setSaving(false); }
  }

  async function changeStatus(client: Client) {
    const status = client.status === "active" ? "paused" : client.status === "demo" ? "paused" : client.billing?.status === "active" ? "active" : "demo";
    const response = await fetch(`/api/central/clients/${client.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (response.ok) await loadClients();
  }

  async function createCheckout(client: Client, plan: "monthly" | "yearly") {
    setCheckoutLoading(`${client.id}:${plan}`);
    setError("");
    try {
      const response = await fetch(`/api/central/clients/${client.id}/checkout`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error ?? "Não foi possível gerar a cobrança.");
      await loadClients();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao gerar o link do Asaas.");
    } finally { setCheckoutLoading(""); }
  }

  async function regeneratePassword(client: Client) {
    const response = await fetch(`/api/central/clients/${client.id}/reset-password`, { method: "POST" });
    const result = (await response.json()) as { initialPassword?: string; error?: string };
    if (!response.ok || !result.initialPassword) { setError(result.error ?? "Não foi possível gerar outra senha."); return; }
    setResetPassword({ clientId: client.id, value: result.initialPassword });
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 1800);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setClients([]);
  }

  if (!loaded) return <main className="central-shell"><p>Verificando acesso...</p></main>;

  if (!authenticated) return (
    <main className="admin-login">
      <form className="admin-login-card" onSubmit={submitLogin}>
        <span className="panel-kicker">CENTRAL DO PRODUTO</span>
        <h1>Entre na sua central.</h1>
        <p>Área privada para administrar as barbearias que usam o sistema.</p>
        <label>Senha da central<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="admin-login-error" role="alert">{error}</p>}
        <button className="button-primary" type="submit">Acessar central</button>
      </form>
    </main>
  );

  return (
    <main className="central-shell">
      <header className="central-header">
        <div className="central-brand"><span className="central-mark"><Scissors size={20} /></span><div><span className="panel-kicker">SUA OPERAÇÃO</span><h1>Central de barbearias</h1></div></div>
        <button className="central-logout" type="button" onClick={() => void logout()}><LogOut size={16} /> Sair</button>
      </header>
      {error && <p className="central-error" role="alert">{error}</p>}
      <section className="central-summary" aria-label="Resumo da central">
        <article><span>BARBEARIAS ATIVAS</span><strong>{activeCount}</strong><small>acessos liberados</small></article>
        <article><span>EM DEMONSTRAÇÃO</span><strong>{demoCount}</strong><small>testes em andamento</small></article>
        <article><span>TOTAL DE CLIENTES</span><strong>{clients.length}</strong><small>contas cadastradas</small></article>
      </section>
      <section className="central-main-grid">
        <article className="central-panel central-create">
          <div className="central-section-title"><div><span className="panel-kicker">NOVA CONTA</span><h2>Preparar uma demo</h2></div><Plus size={18} /></div>
          <p>Cadastre a barbearia e gere um link de demonstração e acesso ao painel.</p>
          <form onSubmit={(event) => void createClient(event)}>
            <label>Nome da barbearia<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Barbearia Central" /></label>
            <label>E-mail do responsável<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.com" /></label>
            <label>WhatsApp (opcional)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label>
            {error && <p className="admin-login-error" role="alert">{error}</p>}
            <button className="button-primary" type="submit" disabled={saving}>{saving ? "Criando..." : "Criar demo"}</button>
          </form>
          {initialPassword && <div className="central-credential"><strong>Acesso inicial — guarde agora</strong><p>A senha aparece só neste momento. Envie-a ao responsável junto do link do painel.</p><code>{initialPassword}</code><button type="button" onClick={() => void copy(initialPassword)}>{copied === initialPassword ? <Check size={15} /> : <Copy size={15} />} Copiar senha</button></div>}
          <small className="central-plan-note">Prepare o link mensal (R$ 49,90) ou anual (R$ 300, cobrança única a cada ano). O acesso é liberado pelo aviso de pagamento confirmado do Asaas.</small>
        </article>
        <section className="central-panel central-clients">
          <div className="central-section-title"><div><span className="panel-kicker">CARTEIRA</span><h2>Barbearias-clientes</h2></div><Users size={18} /></div>
          {clients.length === 0 ? <div className="central-empty">As demos criadas aparecerão aqui.</div> : <div className="central-client-list">
            {clients.map((client) => {
              const demoLink = `${window.location.origin}${client.demoUrl}`;
              const panelLink = `${window.location.origin}${client.panelUrl}`;
              const phoneDigits = client.phone.replace(/\D/g, "");
              const paymentText = client.billing?.checkoutUrl ? ` Para seguir com o plano ${client.billing.plan === "monthly" ? "mensal de R$ 49,90" : "anual de R$ 300"}, use este link seguro: ${client.billing.checkoutUrl}.` : "";
              const shareText = `Olá! Aqui está a demonstração da ${client.name}: ${demoLink}. Para testar o painel, acesse ${panelLink}.${paymentText}`;
              return <article className="central-client-card" key={client.id}>
                <div className="central-client-top"><div className="central-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div className="central-client-name"><strong>{client.name}</strong><span>{client.email}</span></div><span className={`central-status central-status-${client.status}`}>{statusLabel[client.status]}</span></div>
                <div className="central-links"><a href={demoLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir demo</a><a href={panelLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Painel</a></div>
                <div className="central-client-actions"><button type="button" disabled={checkoutLoading.startsWith(`${client.id}:`)} onClick={() => void createCheckout(client, "monthly")}>{checkoutLoading === `${client.id}:monthly` ? "Gerando..." : "Link mensal · R$ 49,90"}</button><button type="button" disabled={checkoutLoading.startsWith(`${client.id}:`)} onClick={() => void createCheckout(client, "yearly")}>{checkoutLoading === `${client.id}:yearly` ? "Gerando..." : "Link anual · R$ 300"}</button></div>
                {client.billing?.checkoutUrl && <div className="central-credential"><strong>{client.billing.status === "active" ? "Plano pago ativo" : client.billing.status === "paused" ? "Plano pausado" : "Aguardando pagamento"} · {client.billing.plan === "monthly" ? "R$ 49,90/mês" : "R$ 300/ano"}</strong><div className="central-client-actions"><a href={client.billing.checkoutUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir link de pagamento</a><button type="button" onClick={() => void copy(client.billing!.checkoutUrl!)}>{copied === client.billing.checkoutUrl ? <Check size={14} /> : <Copy size={14} />} Copiar cobrança</button></div></div>}
                <div className="central-client-actions"><button type="button" onClick={() => void copy(demoLink)}>{copied === demoLink ? <Check size={14} /> : <Copy size={14} />} Copiar demo</button>{phoneDigits ? <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Send size={14} /> Preparar WhatsApp</a> : <button type="button" onClick={() => void copy(shareText)}>{copied === shareText ? <Check size={14} /> : <Copy size={14} />} Copiar mensagem</button>}<button type="button" onClick={() => void regeneratePassword(client)}>Gerar senha</button><button type="button" onClick={() => void changeStatus(client)}>{client.status === "active" ? "Pausar acesso" : client.status === "demo" ? "Pausar demo" : client.billing?.status === "active" ? "Reativar acesso pago" : "Reabrir demo"}</button></div>
                {resetPassword?.clientId === client.id && <div className="central-credential central-reset-password"><strong>Nova senha — copie antes de sair</strong><code>{resetPassword.value}</code><button type="button" onClick={() => void copy(resetPassword.value)}>{copied === resetPassword.value ? <Check size={15} /> : <Copy size={15} />} Copiar senha</button></div>}
                <small className="central-client-created">Criada em {new Date(client.created_at).toLocaleDateString("pt-BR")}</small>
              </article>;
            })}
          </div>}
        </section>
      </section>
    </main>
  );
}
