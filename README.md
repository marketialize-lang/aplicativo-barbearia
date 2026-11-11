# Prosperous Barbershop

Aplicativo responsivo para gestão de barbearias, com a ideia **“Agenda que ocupa a cadeira”**. A versão atual é uma demonstração interativa: os dados de exemplo e as alterações ficam no `localStorage` do navegador.

## Demonstração disponível

- Painel diário, semanal e mensal, com faturamento baseado em atendimentos e vendas marcados como pagos.
- Visão simulada de proprietário e barbeiro; o barbeiro vê seus próprios dados e ajusta sua disponibilidade e serviços atendidos.
- Cadastro de equipe, serviços e produtos; registro manual de vendas.
- Fluxo público de agendamento sem conta, com seleção de serviço, barbeiro, dia e horário.
- Links públicos da barbearia (`/b/:shopSlug`) e do barbeiro (`/b/:shopSlug/:barberSlug`).
- Personalização local do nome, logotipo, cores prontas ou personalizadas, contatos, jornada e janela de cancelamento.
- Preferências de confirmação por e-mail para cliente, barbearia e barbeiro, com lembrete ajustável.
- Catálogo público de produtos, sem checkout online.

Use o seletor **“Ver como”** para alternar a demonstração entre proprietário e barbeiros. **Restaurar** apaga as alterações de demonstração e repõe os dados de exemplo.

## Executar localmente

Requer Bun (recomendado, por causa do `bun.lock`) ou Node.js com npm.

```sh
bun install --frozen-lockfile
bun run dev
```

Verificações disponíveis:

```sh
bun run test
bun run lint
bun x tsc --noEmit
bun run build
```

## Limites desta demonstração

Esta versão guarda dados e configurações somente no navegador atual. Não há contas reais, sincronização entre dispositivos, persistência compartilhada entre barbearias nem envio automático de e-mails. As preferências de destinatários e lembretes já podem ser ajustadas no painel; para enviar mensagens e sincronizar reservas em produção, o aplicativo ainda precisa de um serviço de dados e de envio conectado. WhatsApp usa links com mensagem pronta, sem envio automático por API.
