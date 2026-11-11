# Prosperous Barbershop

Aplicativo responsivo para gestão de barbearias, com a ideia **“Agenda que ocupa a cadeira”**. A versão atual é uma demonstração interativa: os dados de exemplo e as alterações ficam no `localStorage` do navegador.

## Demonstração disponível

- Painel diário, semanal e mensal, com faturamento baseado em atendimentos e vendas marcados como pagos.
- Visão simulada de proprietário e barbeiro; o barbeiro vê seus próprios dados e ajusta sua disponibilidade e serviços atendidos.
- Cadastro de equipe, serviços e produtos; registro manual de vendas.
- Fluxo público de agendamento sem conta, com seleção de serviço, barbeiro, dia e horário.
- Links públicos da barbearia (`/b/:shopSlug`) e do barbeiro (`/b/:shopSlug/:barberSlug`).
- Personalização local do nome, logotipo, cor de destaque, contatos, jornada e janela de cancelamento.
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

## Próxima etapa para produção

Cadastro/login, autorização real por função, persistência multi-barbearia, bloqueio atômico de reservas, cancelamento/remarcação por token seguro e envio de confirmações e lembretes por e-mail ainda precisam ser conectados ao backend da Lovable. O `AGENTS.md` do repositório exige que alterações no banco sejam feitas no editor da Lovable; não crie migrations manualmente. E-mail depende de provedor e domínio remetente configurados. WhatsApp, nesta versão, usa links de conversa com mensagem pronta, sem API automatizada.

O projeto está conectado à [Lovable](https://lovable.dev/projects/f3be5d32-cd00-4aa8-a0ec-4ecfacefdfe1); alterações enviadas ao branch conectado sincronizam o código com o editor.
