# Prosperous Barbershop

Aplicativo responsivo para gestão de barbearias, com a ideia **“Agenda que ocupa a cadeira”**. A versão atual é uma demonstração interativa: os dados de exemplo e as alterações ficam no `localStorage` do navegador.

## Demonstração disponível

- Painel diário, semanal e mensal, com faturamento baseado em atendimentos e vendas marcados como pagos.
- Visão simulada de proprietário e barbeiro; o barbeiro vê seus próprios dados e ajusta sua disponibilidade e serviços atendidos.
- Cadastro de equipe, serviços e produtos; registro manual de vendas.
- Fluxo público de agendamento sem conta, com seleção de serviço, barbeiro, dia e horário.
- Notificações internas de novos agendamentos, sincronizadas entre abas abertas no mesmo navegador, com som de caixa registradora e aviso do navegador opcionais.
- Links públicos da barbearia (`/b/:shopSlug`) e do barbeiro (`/b/:shopSlug/:barberSlug`).
- Personalização local do nome, logotipo, cores prontas ou personalizadas, contatos, jornada e janela de cancelamento.
- Avisos internos de novos agendamentos, com som de caixa registradora e alerta do navegador opcionais.
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

## MVP SaaS: central e contas por barbearia

O produto foi estruturado para operar com uma central privada (`/central`) e contas isoladas por barbearia. A central cria a conta de demonstração, mostra links para a página pública e para o painel, permite preparar o convite por WhatsApp e ativar ou pausar o acesso. Cada barbearia usa seu próprio identificador e senha, configura marca, agenda, equipe e serviços; os dados e agendamentos ficam separados por conta.

A central prepara links de assinatura Asaas para R$ 49,90 por mês ou R$ 300 por ano (uma cobrança a cada ciclo anual). O pagamento é feito na página hospedada do Asaas, com PIX ou cartão. O painel só ativa a conta quando recebe o evento de pagamento confirmado; atraso, estorno, exclusão ou contestação podem pausar o acesso. A criação de link depende de cadastrar `ASAAS_API_KEY` como secret do Worker. A chave de Sandbox é usada para testes e a chave de Produção só deve ser conectada quando você decidir começar cobranças reais. O primeiro link gerado registra automaticamente o webhook seguro do aplicativo no Asaas.

## Serviços gratuitos preparados

- Cloudflare Workers com endereço gratuito `workers.dev` para servir o app e as rotas de servidor.
- Cloudflare D1 para contas, configurações e agendamentos. A tabela `barber_clients` separa as contas.
- Google Apps Script / Gmail para avisar a barbearia e confirmar o horário ao cliente sem domínio próprio. A conta Gmail que hospeda o script envia até 100 destinatários por dia em contas pessoais, sujeito às cotas e políticas do Google. Cada agendamento usa dois destinatários.
- GitHub mantém o código-fonte.

O banco é o D1 do Cloudflare, em vez de duplicar os mesmos dados também no Supabase: assim o MVP usa uma única camada de dados no plano gratuito do Cloudflare.

Não há dependência de Cloudflare Email Service, domínio comprado, Supabase pago ou plano Workers Paid. O domínio `workers.dev` é somente o endereço do site; as mensagens saem pela conta Gmail conectada ao Apps Script. A opção gratuita tem limites e pode mudar conforme as políticas dos provedores.

No Workers Free, o Cloudflare documenta até 100 mil requisições por dia; o D1 inclui 5 milhões de linhas lidas e 100 mil escritas por dia e 5 GB de armazenamento. Mantenha a conta no plano Free: ao atingir as cotas incluídas, a operação pode falhar até a janela seguinte. Este projeto não troca o plano da conta nem ativa compras.

## Publicação e ativação

1. Use uma conta Cloudflare no Workers Free e autentique a CLI oficial (`bunx wrangler login`). O endereço gratuito `workers.dev` é ligado ao Worker quando publicado.
2. Crie o D1 gratuito: `bunx wrangler d1 create barbearia-mvp`. Guarde o ID retornado.
3. Aplique a estrutura: `bunx wrangler d1 execute barbearia-mvp --remote --file=migrations/0001_mvp.sql`.
4. Exporte o ID no terminal: `export CLOUDFLARE_D1_DATABASE_ID=ID_DO_D1`.
5. Rode `bun run build` e cadastre a senha privada da central e o segredo de sessão com `bunx wrangler secret put ADMIN_PASSWORD --config .output/server/wrangler.json` e `bunx wrangler secret put SESSION_SECRET --config .output/server/wrangler.json`.
6. Publique com `bun run deploy:cloudflare`. O script compila, configura o binding `DB` no Worker e publica pelo plano vigente da conta.
7. Acesse `/central`, entre com a senha e cadastre a primeira barbearia. A senha inicial do painel aparece uma única vez; copie e envie junto com a demo.
8. Para e-mail, siga `google-apps-script/README.md`, publique `google-apps-script/Code.gs` como Web App executado pela sua conta Google e cadastre cada valor com `bunx wrangler secret put NOME_DO_SECRET --config .output/server/wrangler.json`.
9. Para testar o Asaas, crie a chave de API Sandbox na conta Asaas e cadastre-a de forma privada no Cloudflare com `bunx wrangler secret put ASAAS_API_KEY --config .output/server/wrangler.json`. Não coloque a chave no código, no navegador ou em mensagens. O prefixo seleciona Sandbox (`$aact_hmlg_`) ou Produção (`$aact_prod_`).

A conta começa em demonstração. Na central, gere e envie o link de plano mensal ou anual. Depois da confirmação recebida pelo webhook do Asaas, o acesso muda para ativo automaticamente. A central também permite pausar ou reabrir o acesso. A senha inicial do painel aparece uma única vez; copie e envie junto com a demo.

## Desenvolvimento local

```sh
bun install --frozen-lockfile
bun run dev
```

`/central` requer secrets e banco quando executado no Worker. Em desenvolvimento local, o painel de uma barbearia continua com a demonstração local existente.
