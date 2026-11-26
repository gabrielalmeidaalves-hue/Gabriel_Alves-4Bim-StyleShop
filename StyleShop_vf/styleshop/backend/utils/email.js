// Envio de e-mail (nodemailer). Se o SMTP não estiver configurado no .env
// (ou o nodemailer não estiver instalado), o e-mail é apenas impresso no terminal.

// lê a variável do .env tirando espaços e aspas (um erro comum ao copiar valores)
const lerVar = k => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');

// A senha de app do Gmail aparece com espaços ("abcd efgh ijkl mnop"); o espaço não faz parte dela
const senhaSmtp = () => lerVar('SMTP_PASS').replace(/\s+/g, '');

function variaveisFaltando() {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(k => !lerVar(k));
}
function smtpConfigurado() {
  return variaveisFaltando().length === 0;
}

// Mostra na inicialização do servidor se o envio real está ligado (sem revelar a senha)
function descreverConfiguracao() {
  if (smtpConfigurado()) {
    return `📧 E-mail: SMTP configurado (${lerVar('SMTP_HOST')}:${lerVar('SMTP_PORT') || 587}, remetente ${lerVar('SMTP_FROM') || lerVar('SMTP_USER')}). Os links de recuperação serão enviados de verdade.`;
  }
  return `📧 E-mail: SMTP NÃO configurado (faltando ou vazio no .env: ${variaveisFaltando().join(', ')}). Os links de recuperação só aparecerão neste terminal.`;
}

// Porta 465 usa conexão segura (SSL) direto; porta 587 usa STARTTLS (secure = false).
// Assim basta trocar a porta no .env, sem precisar de outra variável.
function usarSsl() {
  const porta = parseInt(lerVar('SMTP_PORT') || '587', 10);
  return porta === 465 || lerVar('SMTP_SECURE') === 'true';
}

function criarTransporte() {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: lerVar('SMTP_HOST'),
    port: parseInt(lerVar('SMTP_PORT') || '587', 10),
    secure: usarSsl(),
    auth: { user: lerVar('SMTP_USER'), pass: senhaSmtp() }
  });
}

async function enviarEmail({ para, assunto, texto, html }) {
  if (!smtpConfigurado()) {
    console.log('\n📧 [SMTP não configurado - e-mail simulado]');
    console.log('Faltando ou vazio no .env:', variaveisFaltando().join(', '));
    console.log('Para:', para);
    console.log('Assunto:', assunto);
    console.log(texto, '\n');
    return { simulado: true };
  }
  let transporte;
  try {
    transporte = criarTransporte();
  } catch (e) {
    console.log('\n📧 [nodemailer não instalado - rode "npm install" - e-mail simulado]');
    console.log('Para:', para, '\n' + texto, '\n');
    return { simulado: true };
  }
  await transporte.sendMail({
    from: lerVar('SMTP_FROM') || `StyleShop <${lerVar('SMTP_USER')}>`,
    to: para, subject: assunto, text: texto, html
  });
  console.log(`✅ E-mail enviado para ${para}`);
  return { simulado: false };
}

module.exports = { enviarEmail, smtpConfigurado, descreverConfiguracao, criarTransporte, lerVar, usarSsl };
