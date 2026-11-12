# E-mail gratuito com Gmail

O app usa um Web App do Google Apps Script como retransmissor. A conta Gmail que publicar o script envia os avisos; não precisa de domínio de remetente.

1. Em `script.google.com`, crie um projeto e cole o conteúdo de `Code.gs`.
2. Em **Configurações do projeto → Propriedades do script**, crie `WEBHOOK_SECRET` com uma chave aleatória longa. Guarde-a para o passo 5.
3. Selecione `doPost` e execute uma vez no editor. Autorize o envio de e-mails pela sua conta Google.
4. Selecione **Implantar → Nova implantação → App da Web**. Execute como sua conta e permita acesso a qualquer pessoa. Copie a URL terminada em `/exec`.
5. No Cloudflare Worker, salve a URL como secret `EMAIL_WEBHOOK_URL` e a mesma chave como secret `EMAIL_WEBHOOK_SECRET`.
6. Salve e publique uma nova versão do Worker. Em Configurações de cada barbearia, preencha o e-mail que receberá os avisos.

O endpoint é público para receber a chamada do Worker, mas confere a chave secreta antes de enviar. Nunca coloque a chave no navegador. Em contas pessoais Gmail, a cota documentada é de até 100 destinatários por dia para envio via Apps Script; cada reserva envia dois e-mails. As cotas podem mudar e se aplicam à conta Google que publicou o script.
