import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { createDemoWorkspace, getAvailableSlots, type DemoWorkspace } from "./lib/barbershop-demo";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

type D1Database = { prepare: (query: string) => D1Statement };
type WorkerEnv = {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  EMAIL_WEBHOOK_URL?: string;
  EMAIL_WEBHOOK_SECRET?: string;
  ASAAS_API_KEY?: string;
};

type CloudflareRuntimeRequest = Request & {
  runtime?: { cloudflare?: { env?: WorkerEnv } };
};

function resolveWorkerEnv(request: Request, env: unknown): WorkerEnv {
  const runtimeEnv = (request as CloudflareRuntimeRequest).runtime?.cloudflare?.env;
  const globalEnv = (globalThis as typeof globalThis & { __env__?: WorkerEnv }).__env__;
  const explicitEnv = env && typeof env === "object" ? env as WorkerEnv : undefined;
  return { ...globalEnv, ...runtimeEnv, ...explicitEnv };
}

type BookingPayload = {
  clientName?: unknown;
  clientEmail?: unknown;
  date?: unknown;
  time?: unknown;
  barberId?: unknown;
  serviceId?: unknown;
  clientPhone?: unknown;
};

type ApiBody = {
  password?: unknown;
  slug?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  status?: unknown;
  workspace?: unknown;
  appointment?: BookingPayload;
  shopSlug?: unknown;
  plan?: unknown;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, headers ? { status, headers } : { status });

function hasDatabase(env: WorkerEnv): env is WorkerEnv & { DB: D1Database } {
  return Boolean(env.DB);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

type Session = { expires: number; role: "central" | "shop"; shopId?: string };

async function signSession(session: Session, secret: string) {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await signValue(payload, secret)}`;
}

async function readSession(request: Request, secret: string): Promise<Session | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.match(/(?:^|;\s*)barber_session=([^;]+)/)?.[1];
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    if (await signValue(payload, secret) !== signature) return null;
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const session = JSON.parse(new TextDecoder().decode(bytes)) as Session;
    if (!Number.isSafeInteger(session.expires) || session.expires <= Date.now()) return null;
    if (session.role === "shop" && typeof session.shopId !== "string") return null;
    return session;
  } catch {
    return null;
  }
}

async function passwordDigest(password: string, shopId: string, secret: string) {
  return signValue(`shop:${shopId}:${password}`, secret);
}

type AsaasPlan = "monthly" | "yearly";
type AsaasBillingState = {
  plan: AsaasPlan;
  checkoutUrl?: string;
  status: "pending" | "active" | "paused";
  customerId?: string;
  subscriptionId?: string;
  updatedAt: string;
};

function asaasApiBase(apiKey: string) {
  if (apiKey.startsWith("$aact_hmlg_") || apiKey.startsWith("aact_hmlg_")) return "https://api-sandbox.asaas.com/v3";
  if (apiKey.startsWith("$aact_prod_") || apiKey.startsWith("aact_prod_")) return "https://api.asaas.com/v3";
  return null;
}

async function asaasFetch<T>(apiKey: string, path: string, body?: unknown) {
  const base = asaasApiBase(apiKey);
  if (!base) throw new Error("A chave Asaas não foi reconhecida. Use uma chave Sandbox ou Produção do Asaas.");
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { access_token: apiKey, accept: "application/json", "content-type": "application/json", "user-agent": "AgendaBarbearia/1.0" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null) as (T & { errors?: Array<{ description?: string }> }) | null;
  if (!response.ok) {
    const message = result?.errors?.map((item) => item.description).filter(Boolean).join(" ");
    throw new Error(message || `O Asaas recusou a solicitação (HTTP ${response.status}).`);
  }
  if (!result) throw new Error("O Asaas retornou uma resposta inválida.");
  return result as T;
}

function saoPauloFirstChargeDate() {
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day} 12:00:00`;
}

async function ensureAsaasWebhook(env: WorkerEnv, request: Request) {
  if (!env.DB || !env.ASAAS_API_KEY || !env.SESSION_SECRET) throw new Error("A integração Asaas ainda não está configurada nesta conta.");
  const existing = await env.DB.prepare("SELECT value FROM app_state WHERE id = 'asaas-webhook-configured'").first<{ value: string }>();
  if (existing) return;
  const webhookToken = await signValue("asaas-webhook-auth-v1", env.SESSION_SECRET);
  const baseUrl = new URL(request.url).origin;
  await asaasFetch(env.ASAAS_API_KEY, "/webhooks", {
    name: "Agenda Barbearia",
    url: `${baseUrl}/api/webhooks/asaas`,
    email: "marketialize@gmail.com",
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: webhookToken,
    sendType: "SEQUENTIALLY",
    events: ["CHECKOUT_PAID", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"],
  });
  await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES ('asaas-webhook-configured', ?, ?)")
    .bind(JSON.stringify({ url: `${baseUrl}/api/webhooks/asaas` }), new Date().toISOString()).run();
}

async function handleAsaasWebhook(request: Request, env: WorkerEnv) {
  if (request.method !== "POST") return json({ error: "Método inválido." }, 405);
  if (!env.DB || !env.SESSION_SECRET) return json({ error: "Webhook indisponível." }, 503);
  const expectedToken = await signValue("asaas-webhook-auth-v1", env.SESSION_SECRET);
  if (request.headers.get("asaas-access-token") !== expectedToken) return json({ error: "Não autorizado." }, 401);
  const event = await request.json().catch(() => null) as {
    id?: unknown; event?: unknown; checkout?: { id?: unknown; customer?: unknown };
    payment?: { id?: unknown; customer?: unknown; subscription?: unknown };
    subscription?: { id?: unknown; customer?: unknown; externalReference?: unknown; status?: unknown };
  } | null;
  if (!event || typeof event.id !== "string" || typeof event.event !== "string") return json({ error: "Evento inválido." }, 400);
  const processedId = `asaas-event:${event.id}`;
  const prior = await env.DB.prepare("SELECT id FROM app_state WHERE id = ?").bind(processedId).first<{ id: string }>();
  if (prior) return json({ received: true, duplicate: true });

  let shopId: string | undefined;
  let customerId: string | undefined;
  if (event.event === "CHECKOUT_PAID" && typeof event.checkout?.id === "string") {
    const row = await env.DB.prepare("SELECT value FROM app_state WHERE id = ?").bind(`asaas-checkout:${event.checkout.id}`).first<{ value: string }>();
    if (row) {
      const billing = JSON.parse(row.value) as AsaasBillingState & { shopId?: string };
      shopId = billing.shopId;
      customerId = typeof event.checkout.customer === "string" ? event.checkout.customer : undefined;
      const next: AsaasBillingState & { shopId?: string } = { ...billing, status: "active", ...(customerId ? { customerId } : {}), updatedAt: new Date().toISOString() };
      await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
        .bind(`asaas-client:${shopId}`, JSON.stringify(next), next.updatedAt).run();
      if (shopId) await env.DB.prepare("UPDATE barber_clients SET status = 'active' WHERE id = ?").bind(shopId).run();
    }
  } else if ((event.payment && typeof event.payment.customer === "string") || (event.subscription && typeof event.subscription.customer === "string")) {
    customerId = event.payment?.customer as string | undefined ?? event.subscription?.customer as string | undefined;
    const row = await env.DB.prepare("SELECT id, value FROM app_state WHERE id LIKE 'asaas-client:%'").all<{ id: string; value: string }>();
    const found = row.results.find((item) => (JSON.parse(item.value) as AsaasBillingState).customerId === customerId);
    if (found) {
      shopId = found.id.slice("asaas-client:".length);
      const billing = JSON.parse(found.value) as AsaasBillingState;
      if (["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED"].includes(event.event) && typeof event.subscription?.id === "string") {
        const updatedAt = new Date().toISOString();
        await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
          .bind(found.id, JSON.stringify({ ...billing, subscriptionId: event.subscription.id, updatedAt }), updatedAt).run();
      }
      const paid = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event.event);
      const declined = ["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"].includes(event.event)
        || (event.event === "SUBSCRIPTION_UPDATED" && event.subscription?.status === "INACTIVE");
      if (paid || declined) {
        const updatedAt = new Date().toISOString();
        const next = { ...billing, status: paid ? "active" : "paused", updatedAt } as AsaasBillingState;
        await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
          .bind(found.id, JSON.stringify(next), updatedAt).run();
        await env.DB.prepare("UPDATE barber_clients SET status = ? WHERE id = ?")
          .bind(paid ? "active" : "paused", shopId).run();
      }
    }
  }

  await env.DB.prepare("INSERT OR IGNORE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
    .bind(processedId, JSON.stringify({ event: event.event, shopId, customerId }), new Date().toISOString()).run();
  return json({ received: true });
}

function sessionCookie(session: Session, secret: string) {
  return signSession(session, secret).then((value) =>
    `barber_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1209600`,
  );
}

function normalizeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "barbearia";
}

async function handleApi(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "/api/webhooks/asaas") return handleAsaasWebhook(request, env);
  if (!hasDatabase(env)) return json({ error: "O banco ainda não está conectado." }, 503);

  const body = ["POST", "PUT", "PATCH"].includes(request.method)
    ? await request.json().catch(() => null) as ApiBody | null
    : null;
  const session = env.SESSION_SECRET ? await readSession(request, env.SESSION_SECRET) : null;
  const isCentral = session?.role === "central";
  const isShop = session?.role === "shop" && typeof session.shopId === "string";

  if (path === "/api/auth/session" && request.method === "GET") {
    let shopSlug: string | null = null;
    if (isShop) shopSlug = (await env.DB.prepare("SELECT slug FROM barber_clients WHERE id = ?").bind(session.shopId).first<{ slug: string }>())?.slug ?? null;
    return json({ configured: Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET), authenticated: Boolean(session), role: session?.role ?? null, shopSlug });
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "A central ainda não foi configurada." }, 503);
    if (typeof body?.password !== "string" || body.password !== env.ADMIN_PASSWORD) return json({ error: "Senha incorreta." }, 401);
    const cookie = await sessionCookie({ expires: Date.now() + 1209600000, role: "central" }, env.SESSION_SECRET);
    return json({ authenticated: true, role: "central" }, 200, { "set-cookie": cookie });
  }

  if (path === "/api/tenant/login" && request.method === "POST") {
    if (!env.SESSION_SECRET) return json({ error: "A autenticação ainda não foi configurada." }, 503);
    const slug = typeof body?.slug === "string" ? normalizeSlug(body.slug) : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const shop = await env.DB.prepare("SELECT id, status, password_hash FROM barber_clients WHERE slug = ?").bind(slug).first<{ id: string; status: string; password_hash: string }>();
    if (!shop || !["demo", "active"].includes(shop.status) || await passwordDigest(password, shop.id, env.SESSION_SECRET) !== shop.password_hash) {
      return json({ error: "Acesso não encontrado. Confira o identificador e a senha." }, 401);
    }
    const cookie = await sessionCookie({ expires: Date.now() + 1209600000, role: "shop", shopId: shop.id }, env.SESSION_SECRET);
    return json({ authenticated: true, role: "shop" }, 200, { "set-cookie": cookie });
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    return json({ authenticated: false }, 200, { "set-cookie": "barber_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  }

  if (path === "/api/central/clients" && request.method === "GET") {
    if (!isCentral) return json({ error: "Acesso restrito à central." }, 401);
    const rows = await env.DB.prepare("SELECT id, name, slug, email, phone, status, created_at FROM barber_clients ORDER BY created_at DESC").all<{
      id: string; name: string; slug: string; email: string; phone: string; status: string; created_at: string;
    }>();
    const clients = await Promise.all(rows.results.map(async (row) => {
      const billing = await env.DB.prepare("SELECT value FROM app_state WHERE id = ?").bind(`asaas-client:${row.id}`).first<{ value: string }>();
      return { ...row, billing: billing ? JSON.parse(billing.value) as AsaasBillingState : null, demoUrl: `/b/${row.slug}`, panelUrl: `/?shop=${row.slug}` };
    }));
    return json({ clients });
  }

  if (path === "/api/central/clients" && request.method === "POST") {
    if (!isCentral || !env.SESSION_SECRET) return json({ error: "Acesso restrito à central." }, 401);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    const phone = typeof body?.phone === "string" ? body.phone.replace(/[^0-9+]/g, "").slice(0, 24) : "";
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe o nome da barbearia e um e-mail válido." }, 400);
    const id = crypto.randomUUID();
    const base = normalizeSlug(name);
    let slug = base;
    let suffix = 2;
    while (await env.DB.prepare("SELECT id FROM barber_clients WHERE slug = ?").bind(slug).first<{ id: string }>()) slug = `${base}-${suffix++}`;
    const initialPassword = base64Url(crypto.getRandomValues(new Uint8Array(15)));
    const workspace = createDemoWorkspace();
    workspace.settings = { ...workspace.settings, name, slug, email };
    workspace.appointments = [];
    workspace.notifications = [];
    workspace.sales = [];
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO barber_clients (id, name, slug, email, phone, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, 'demo', ?, ?)")
      .bind(id, name, slug, email, phone, await passwordDigest(initialPassword, id, env.SESSION_SECRET), createdAt).run();
    await env.DB.prepare("INSERT INTO tenant_state (shop_id, value, updated_at) VALUES (?, ?, ?)")
      .bind(id, JSON.stringify(workspace), createdAt).run();
    return json({ client: { id, name, slug, email, phone, status: "demo", created_at: createdAt, demoUrl: `/b/${slug}`, panelUrl: `/?shop=${slug}` }, initialPassword }, 201);
  }

  const clientMatch = path.match(/^\/api\/central\/clients\/([a-f0-9-]+)$/);
  const checkoutMatch = path.match(/^\/api\/central\/clients\/([a-f0-9-]+)\/checkout$/);
  const resetPasswordMatch = path.match(/^\/api\/central\/clients\/([a-f0-9-]+)\/reset-password$/);
  if (checkoutMatch && request.method === "POST") {
    if (!isCentral) return json({ error: "Acesso restrito à central." }, 401);
    if (!env.ASAAS_API_KEY) return json({ error: "Asaas ainda não conectado. Falta cadastrar com segurança a chave da API no Cloudflare." }, 503);
    const plan = body?.plan;
    if (plan !== "monthly" && plan !== "yearly") return json({ error: "Escolha um plano válido." }, 400);
    const client = await env.DB.prepare("SELECT id, name FROM barber_clients WHERE id = ?").bind(checkoutMatch[1]).first<{ id: string; name: string }>();
    if (!client) return json({ error: "Barbearia não encontrada." }, 404);
    try {
      const current = await env.DB.prepare("SELECT value FROM app_state WHERE id = ?").bind(`asaas-client:${client.id}`).first<{ value: string }>();
      const currentBilling = current ? JSON.parse(current.value) as AsaasBillingState : null;
      if (currentBilling?.status === "active") return json({ error: "Esta barbearia já tem um plano pago ativo." }, 409);
      if (currentBilling?.status === "paused" && currentBilling.subscriptionId) return json({ error: "Esta conta tem uma assinatura anterior. Cancele ou regularize-a no Asaas antes de criar outra para evitar cobranças duplicadas." }, 409);
      if (currentBilling?.status === "pending" && Date.now() - new Date(currentBilling.updatedAt).getTime() < 24 * 60 * 60 * 1000) return json({ error: "Já existe um link de pagamento válido para esta barbearia. Use o link mostrado no cartão ou aguarde até ele expirar." }, 409);
      const checkoutReference = `${client.id}:${plan}:${crypto.randomUUID()}`;
      await ensureAsaasWebhook(env, request);
      const cycle = plan === "monthly" ? "MONTHLY" : "YEARLY";
      const value = plan === "monthly" ? 49.9 : 300;
      const origin = new URL(request.url).origin;
      const checkout = await asaasFetch<{ id?: string }>(env.ASAAS_API_KEY, "/checkouts", {
        billingTypes: ["PIX", "CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 1440,
        externalReference: checkoutReference,
        callback: { successUrl: `${origin}/?pagamento=retorno`, cancelUrl: `${origin}/?pagamento=cancelado`, expiredUrl: `${origin}/?pagamento=expirado` },
        items: [{ name: `Agenda da Barbearia — ${plan === "monthly" ? "Plano mensal" : "Plano anual"}`, description: `${client.name} · ${cycle === "MONTHLY" ? "R$ 49,90 por mês" : "R$ 300 por ano"}`, quantity: 1, value }],
        subscription: { cycle, nextDueDate: saoPauloFirstChargeDate() },
      });
      if (!checkout.id) throw new Error("O Asaas criou uma resposta sem identificador de checkout.");
      const sandbox = env.ASAAS_API_KEY.startsWith("$aact_hmlg_") || env.ASAAS_API_KEY.startsWith("aact_hmlg_");
      const checkoutUrl = `https://${sandbox ? "sandbox." : ""}asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
      const createdAt = new Date().toISOString();
      const billing: AsaasBillingState & { shopId: string } = { plan, checkoutUrl, status: "pending", updatedAt: createdAt, shopId: client.id };
      await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
        .bind(`asaas-checkout:${checkout.id}`, JSON.stringify(billing), createdAt).run();
      await env.DB.prepare("INSERT OR REPLACE INTO app_state (id, value, updated_at) VALUES (?, ?, ?)")
        .bind(`asaas-client:${client.id}`, JSON.stringify(billing), createdAt).run();
      return json({ checkoutUrl, plan, value });
    } catch (error) {
      console.error("Falha ao preparar checkout Asaas", error instanceof Error ? error.message : "unknown");
      return json({ error: error instanceof Error ? error.message : "Não foi possível conectar ao Asaas." }, 502);
    }
  }
  if (resetPasswordMatch && request.method === "POST") {
    if (!isCentral || !env.SESSION_SECRET) return json({ error: "Acesso restrito à central." }, 401);
    const newPassword = base64Url(crypto.getRandomValues(new Uint8Array(15)));
    await env.DB.prepare("UPDATE barber_clients SET password_hash = ? WHERE id = ?")
      .bind(await passwordDigest(newPassword, resetPasswordMatch[1]!, env.SESSION_SECRET), resetPasswordMatch[1]).run();
    return json({ initialPassword: newPassword });
  }
  if (clientMatch && request.method === "PATCH") {
    if (!isCentral) return json({ error: "Acesso restrito à central." }, 401);
    const status = body?.status;
    if (!new Set(["demo", "active", "paused"]).has(String(status))) return json({ error: "Status inválido." }, 400);
    await env.DB.prepare("UPDATE barber_clients SET status = ? WHERE id = ?").bind(status, clientMatch[1]).run();
    return json({ saved: true });
  }

  if (path === "/api/public-workspace" && request.method === "GET") {
    const slug = url.searchParams.get("shop");
    if (!slug) return json({ workspace: null, configured: false });
    const shop = await env.DB.prepare("SELECT id, status FROM barber_clients WHERE slug = ?").bind(normalizeSlug(slug)).first<{ id: string; status: string }>();
    if (!shop || !["demo", "active"].includes(shop.status)) return json({ workspace: null, configured: false });
    const row = await env.DB.prepare("SELECT value FROM tenant_state WHERE shop_id = ?").bind(shop.id).first<{ value: string }>();
    if (!row) return json({ workspace: null, configured: false });
    const workspace = JSON.parse(row.value) as DemoWorkspace;
    return json({ configured: true, workspace: {
      settings: { ...workspace.settings, email: "" }, barbers: workspace.barbers, services: workspace.services, products: workspace.products,
      appointments: workspace.appointments.map(({ id, date, time, barberId, serviceId, duration, status }) => ({ id, date, time, barberId, serviceId, duration, status })),
      notifications: [], sales: [],
    } });
  }

  if (path === "/api/workspace" && (request.method === "GET" || request.method === "PUT")) {
    if (!isShop || !session.shopId) return json({ error: "Entre no painel da barbearia." }, 401);
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT value FROM tenant_state WHERE shop_id = ?").bind(session.shopId).first<{ value: string }>();
      return json({ workspace: row ? JSON.parse(row.value) : null });
    }
    if (!body?.workspace || typeof body.workspace !== "object") return json({ error: "Configuração inválida." }, 400);
    const value = JSON.stringify(body.workspace);
    if (value.length > 500_000) return json({ error: "A configuração excede o limite permitido." }, 413);
    const workspace = body.workspace as DemoWorkspace;
    const slug = normalizeSlug(workspace.settings.slug);
    const conflicting = await env.DB.prepare("SELECT id FROM barber_clients WHERE slug = ? AND id != ?").bind(slug, session.shopId).first<{ id: string }>();
    if (conflicting) return json({ error: "Esse endereço público já está sendo usado por outra barbearia." }, 409);
    await env.DB.prepare("UPDATE barber_clients SET name = ?, email = ?, phone = ?, slug = ? WHERE id = ?")
      .bind(workspace.settings.name.slice(0, 100), workspace.settings.email.slice(0, 254), workspace.settings.phone.slice(0, 24), slug, session.shopId).run();
    await env.DB.prepare("UPDATE tenant_state SET value = ?, updated_at = ? WHERE shop_id = ?").bind(value, new Date().toISOString(), session.shopId).run();
    const appointments = workspace.appointments ?? [];
    for (const item of appointments) {
      if (item && typeof item.id === "string" && typeof item.status === "string") {
        await env.DB.prepare("UPDATE tenant_bookings SET status = ?, appointment_json = ? WHERE id = ? AND shop_id = ?")
          .bind(item.status, JSON.stringify(item), item.id, session.shopId).run();
      }
    }
    return json({ saved: true });
  }

  if (path === "/api/bookings" && request.method === "POST") {
    const appointment = body?.appointment as BookingPayload | undefined;
    const slug = typeof body?.shopSlug === "string" ? normalizeSlug(body.shopSlug) : "";
    if (!appointment || typeof appointment.clientName !== "string" || typeof appointment.clientEmail !== "string" || typeof appointment.date !== "string" || typeof appointment.time !== "string" || typeof appointment.barberId !== "string" || typeof appointment.serviceId !== "string") return json({ error: "Dados do agendamento incompletos." }, 400);
    const shop = await env.DB.prepare("SELECT id, status FROM barber_clients WHERE slug = ?").bind(slug).first<{ id: string; status: string }>();
    if (!shop || !["demo", "active"].includes(shop.status)) return json({ error: "A barbearia não está aceitando agendamentos." }, 404);
    const clientName = appointment.clientName.trim();
    const clientEmail = appointment.clientEmail.trim().toLowerCase();
    if (clientName.length < 2 || clientName.length > 100 || clientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return json({ error: "Informe um nome e um e-mail válidos." }, 400);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))));
    const now = Date.now();
    const limit = await env.DB.prepare("INSERT INTO tenant_booking_rate_limits (shop_id, ip_hash, window_start, count) VALUES (?, ?, ?, 1) ON CONFLICT(shop_id, ip_hash) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END RETURNING count")
      .bind(shop.id, ipHash, now, now - 3600000, now - 3600000, now).first<{ count: number }>();
    if ((limit?.count ?? 0) > 5) return json({ error: "Muitas tentativas de agendamento. Aguarde e tente novamente." }, 429);
    const state = await env.DB.prepare("SELECT value FROM tenant_state WHERE shop_id = ?").bind(shop.id).first<{ value: string }>();
    if (!state) return json({ error: "A barbearia ainda não configurou o painel." }, 503);
    const workspace = JSON.parse(state.value) as DemoWorkspace;
    const barber = workspace.barbers.find((item) => item.id === appointment.barberId && item.active);
    const service = workspace.services.find((item) => item.id === appointment.serviceId && item.active);
    if (!barber || !service || !barber.serviceIds.includes(service.id)) return json({ error: "O serviço ou barbeiro selecionado não está disponível." }, 400);
    if (!getAvailableSlots(workspace, barber, service, appointment.date).includes(appointment.time)) return json({ error: "Esse horário acabou de ser reservado. Escolha outro horário." }, 409);
    const duration = barber.serviceDurations[service.id] ?? service.duration;
    const persisted = { id: crypto.randomUUID(), date: appointment.date, time: appointment.time, barberId: barber.id, serviceId: service.id, clientName,
      clientPhone: typeof appointment.clientPhone === "string" ? appointment.clientPhone.replace(/\D/g, "").slice(0, 18) : "", clientEmail, duration,
      price: service.price, status: "confirmed", paid: false, createdAt: new Date().toISOString(), manageToken: crypto.randomUUID() };
    try {
      await env.DB.prepare("INSERT INTO tenant_bookings (id, shop_id, appointment_json, created_at, booking_date, booking_time, barber_id, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')")
        .bind(persisted.id, shop.id, JSON.stringify(persisted), persisted.createdAt, persisted.date, persisted.time, persisted.barberId, persisted.duration).run();
    } catch { return json({ error: "Esse horário já foi reservado. Escolha outro horário." }, 409); }
    const updated = { ...workspace, appointments: [...workspace.appointments, persisted], notifications: [...workspace.notifications, { id: crypto.randomUUID(), appointmentId: persisted.id, createdAt: persisted.createdAt, read: false }] };
    await env.DB.prepare("UPDATE tenant_state SET value = ?, updated_at = ? WHERE shop_id = ?").bind(JSON.stringify(updated), new Date().toISOString(), shop.id).run();
    let emailStatus: "sent" | "not-configured" | "failed" = "not-configured";
    if (env.EMAIL_WEBHOOK_URL && env.EMAIL_WEBHOOK_SECRET && /^\S+@\S+\.\S+$/.test(workspace.settings.email)) {
      try {
        const when = `${persisted.date} às ${persisted.time}`;
        const response = await fetch(env.EMAIL_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: env.EMAIL_WEBHOOK_SECRET, messages: [
          { to: workspace.settings.email, subject: `Novo agendamento · ${workspace.settings.name}`, text: `Novo horário reservado por ${clientName} (${clientEmail}) para ${when}.` },
          { to: clientEmail, subject: `Seu horário está confirmado · ${workspace.settings.name}`, text: `Olá, ${clientName}! Seu horário foi reservado para ${when}.` },
        ] }) });
        const result = await response.json().catch(() => null) as { sent?: number } | null;
        emailStatus = result?.sent === 2 ? "sent" : "failed";
      } catch (error) { console.error("Falha no envio de e-mail de agendamento", error); emailStatus = "failed"; }
    }
    return json({ saved: true, emailStatus, appointment: persisted }, 201);
  }

  return json({ error: "Rota não encontrada." }, 404);
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const workerEnv = resolveWorkerEnv(request, env);
      const apiResponse = await handleApi(request, workerEnv);
      if (apiResponse) return apiResponse;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, workerEnv, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
