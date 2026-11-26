// StyleShop - servidor Express (arquitetura Cliente/Servidor + MVC)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./database');
const { descreverConfiguracao } = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 3001;
const caminhoFrontend = path.join(__dirname, '../frontend');
const caminhoImagens = path.join(__dirname, '../imagens');

app.use(express.json());
app.use(cookieParser());

// Telas (arquivos .html) restritas: não podem ser abertas digitando o caminho do arquivo direto
const { paginaAdmin, paginaLogin } = require('./middleware/auth');
app.use((req, res, next) => {
  if (!/\.html$/i.test(req.path)) return next();
  if (req.path === '/admin.html' || /^\/(cargo|pessoa|pedido|produto|forma_pagamento|categoria_roupa)\//.test(req.path)) {
    return paginaAdmin(req, res, next);
  }
  if (/^\/visaoCliente\/(finalizar|pagamento|meuspedidos)\//.test(req.path)) return paginaLogin(req, res, next);
  next();
});

// Arquivos estáticos (HTML/CSS/JS do front e imagens)
// redirect:false -> evita o 301 de /produto para /produto/ (as pastas do front têm o mesmo nome das rotas da API)
app.use(express.static(caminhoFrontend, { redirect: false }));
app.use('/imagens', express.static(caminhoImagens));

// ----------------- ROTAS (Router -> Controller) -----------------
app.use('/menu', require('./routes/menuRoutes'));
app.use('/', require('./routes/imageRoutes')); // /view-image/:id (o upload fica em /produto/upload/:id)
app.use('/login', require('./routes/loginRoutes'));
app.use('/cargo', require('./routes/cargoRoutes'));
app.use('/categoria_roupa', require('./routes/categoriaRoupaRoutes'));
app.use('/produto', require('./routes/produtoRoutes'));
app.use('/forma_pagamento', require('./routes/forma_pagamentoRoutes'));
app.use('/pessoa', require('./routes/pessoaRoutes'));
app.use('/cliente', require('./routes/clienteRoutes'));
app.use('/funcionario', require('./routes/funcionarioRoutes'));
app.use('/frete', require('./routes/freteRoutes'));
app.use('/pedido', require('./routes/pedidoRoutes'));
app.use('/pedido_has_produto', require('./routes/pedido_has_produtoRoutes'));
app.use('/pagamento', require('./routes/pagamentoRoutes'));

app.get('/', (req, res) => res.redirect('/menu'));

app.get('/health', async (req, res) => {
  const ok = await db.testConnection();
  res.status(ok ? 200 : 500).json({ status: ok ? 'OK' : 'ERROR', database: 'PostgreSQL', timestamp: new Date().toISOString() });
});

// JSON malformado
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado' });
  }
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada', message: `A rota ${req.originalUrl} não existe` });
});

(async () => {
  const conectou = await db.testConnection();
  if (!conectou) {
    console.error('❌ Falha na conexão com o PostgreSQL. Confira o arquivo .env e se o banco foi criado.');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`🚀 StyleShop rodando em http://localhost:${PORT}`);
    console.log(`🗄️  Banco: ${db.pool.options.database} (usuário ${db.pool.options.user})`);
    console.log(descreverConfiguracao());
  });
})();

process.on('SIGINT', async () => {
  await db.pool.end();
  process.exit(0);
});
