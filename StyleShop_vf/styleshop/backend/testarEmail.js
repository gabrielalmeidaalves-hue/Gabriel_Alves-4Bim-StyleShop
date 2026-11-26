// Uso: npm run testar-email seu@email.com
// Envia uma mensagem de teste e mostra o motivo exato se o servidor de e-mail recusar.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { descreverConfiguracao, smtpConfigurado, criarTransporte, lerVar } = require('./utils/email');

(async () => {
  const para = process.argv[2];
  console.log(descreverConfiguracao());
  if (!para) { console.log('Informe o destinatário: npm run testar-email seu@email.com'); process.exit(1); }
  if (!smtpConfigurado()) { console.log('Preencha SMTP_HOST, SMTP_USER e SMTP_PASS no arquivo .env (na raiz do projeto) e tente de novo.'); process.exit(1); }
  try {
    const t = criarTransporte();
    await t.verify(); // confere host, porta, usuário e senha
    console.log('✅ Conexão e login no servidor de e-mail OK. Enviando...');
    await t.sendMail({ from: lerVar('SMTP_FROM') || `StyleShop <${lerVar('SMTP_USER')}>`, to: para, subject: 'StyleShop - teste de e-mail', text: 'Se você recebeu esta mensagem, o envio de e-mails do StyleShop está funcionando.' });
    console.log('✅ E-mail de teste enviado para', para, '(veja também a caixa de spam).');
  } catch (e) {
    console.error('❌ Falha:', e.code || '', e.message);
    if (/Invalid login|535|Username and Password/i.test(e.message)) console.error('Dica: use a SENHA DE APP do Gmail (16 letras), não a senha normal da conta.');
    if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ESOCKET/i.test(e.code + e.message)) console.error('Dica: sem internet ou a rede bloqueia a porta 587 (comum em escolas). Tente outra rede.');
    process.exit(1);
  }
})();
