// Autorização baseada no cookie "usuarioLogado" (definido no login)
// Visão administrativa = funcionário com cargo administrativo (ver config/cargos.js)
// Visão do cliente    = quem existe na tabela cliente
// O login já calcula u.admin (true/false) e guarda no cookie.

function lerUsuario(req) {
  try {
    const bruto = req.cookies && req.cookies.usuarioLogado;
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

function ehAdmin(u) {
  return !!(u && u.admin === true);
}

// Para rotas de API: responde JSON com 401/403
function exigirLogin(req, res, next) {
  const u = lerUsuario(req);
  if (!u) return res.status(401).json({ error: 'É necessário fazer login.' });
  req.usuario = u;
  next();
}

function exigirCliente(req, res, next) {
  const u = lerUsuario(req);
  if (!u) return res.status(401).json({ error: 'É necessário fazer login.' });
  if (!u.ehCliente) return res.status(403).json({ error: 'Apenas clientes podem realizar compras.' });
  req.usuario = u;
  next();
}

function exigirAdmin(req, res, next) {
  const u = lerUsuario(req);
  if (!u) return res.status(401).json({ error: 'É necessário fazer login.' });
  if (!ehAdmin(u)) return res.status(403).json({ error: 'Acesso restrito a funcionários/administradores.' });
  req.usuario = u;
  next();
}

// Para rotas que abrem telas (HTML): redireciona em vez de responder JSON
function paginaLogin(req, res, next) {
  const u = lerUsuario(req);
  if (!u) return res.redirect('/login/?voltar=' + encodeURIComponent(req.originalUrl));
  req.usuario = u;
  next();
}

function paginaAdmin(req, res, next) {
  const u = lerUsuario(req);
  if (!u) return res.redirect('/login/?voltar=' + encodeURIComponent(req.originalUrl));
  if (!ehAdmin(u)) return res.redirect('/menu?acessoNegado=1');
  req.usuario = u;
  next();
}

module.exports = { lerUsuario, ehAdmin, exigirLogin, exigirCliente, exigirAdmin, paginaLogin, paginaAdmin };
