const db = require('../database.js');
const { CARGOS_ADMIN } = require('../config/cargos');
const path = require('path');
const crypto = require('crypto');
const { enviarEmail } = require('../utils/email');

// ===== Validações deste controller =====

// data de hoje (AAAA-MM-DD)
function hoje() {
  const d = new Date();
  let mes = String(d.getMonth() + 1);
  let dia = String(d.getDate());
  if (mes.length < 2) mes = '0' + mes;
  if (dia.length < 2) dia = '0' + dia;
  return d.getFullYear() + '-' + mes + '-' + dia;
}

// true se a data (AAAA-MM-DD...) for depois de hoje
function dataEhFutura(texto) {
  if (!texto) return false;
  return String(texto).slice(0, 10) > hoje();
}

// CPF: exatamente 11 dígitos
function cpfValido(texto) {
  texto = String(texto || '');
  if (texto.length !== 11) return false;
  return /^[0-9]+$/.test(texto);
}

// e-mail simples: algo@dominio.ext
function emailValido(texto) {
  texto = String(texto || '');
  const posArroba = texto.indexOf('@');
  if (posArroba < 1) return false;
  if (texto.indexOf(' ') !== -1) return false;
  const resto = texto.slice(posArroba + 1);
  if (resto.indexOf('@') !== -1) return false;
  if (resto.indexOf('.') < 1) return false;
  if (resto.slice(-1) === '.') return false;
  return true;
}

// ===== Fim das validações =====



const CPF_LOJA_ONLINE = '00000000000'; // funcionário "online" (apenas registra pedidos feitos pelo site; não faz login)
const COOKIE_OPCOES = { sameSite: 'lax', secure: false, httpOnly: true, path: '/' };

exports.abrirTelaLogin = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/login/login.html'));
};
exports.abrirVisaoCliente = (req, res) => res.redirect('/menu');
exports.abrirVisaoClienteCarrinho = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/visaoCliente/carrinho/carrinho.html'));
};
// a rota já passa por paginaLogin (redireciona para /login se não houver cookie)
exports.abrirVisaoClienteFinalizar = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/visaoCliente/finalizar/finalizar.html'));
};

// Informa ao front quem está logado (o cookie é httpOnly e não pode ser lido pelo JavaScript)
exports.verificaSeUsuarioEstaLogado = (req, res) => {
  const usuario = req.cookies.usuarioLogado;
  if (usuario) return res.json({ status: 'ok', usuario });
  res.json({ status: 'nao_logado', mensagem: 'Usuário não autenticado.' });
};

// Login: e-mail + senha. Define o cookie "usuarioLogado" com o perfil (cliente e/ou funcionário)
exports.verificarSenha = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ status: 'erro', mensagem: 'Informe e-mail e senha.' });
  try {
    const pessoa = await db.query(
      'SELECT cpf_pessoa, nome_pessoa FROM pessoa WHERE email_pessoa = $1 AND senha_pessoa = $2',
      [email.trim(), senha]
    );
    if (pessoa.rows.length === 0 || pessoa.rows[0].cpf_pessoa === CPF_LOJA_ONLINE) {
      return res.json({ status: 'senha_incorreta' });
    }
    const { cpf_pessoa, nome_pessoa } = pessoa.rows[0];

    const cliente = await db.query('SELECT 1 FROM cliente WHERE pessoa_cpf_pessoa = $1', [cpf_pessoa]);
    const func = await db.query(
      `SELECT c.id_cargo, c.nome_cargo FROM funcionario f
       JOIN cargo c ON c.id_cargo = f.cargo_id_cargo WHERE f.pessoa_cpf_pessoa = $1`,
      [cpf_pessoa]
    );
    const ehFuncionario = func.rows.length > 0 ? func.rows[0] : { id_cargo: -1, nome_cargo: 'Cliente' };

    // admin = funcionário cujo cargo está na lista CARGOS_ADMIN (gerente, supervisor, diretor)
    const admin = CARGOS_ADMIN.includes(Number(ehFuncionario.id_cargo));

    const dadosUsuario = {
      cpf_pessoa,
      nome: nome_pessoa,
      ehCliente: cliente.rows.length > 0,
      ehFuncionario,
      admin
    };
    res.cookie('usuarioLogado', JSON.stringify(dadosUsuario), { ...COOKIE_OPCOES, maxAge: 24 * 60 * 60 * 1000 });
    return res.json({ status: 'ok', nome: nome_pessoa, admin });
  } catch (err) {
    console.error('Erro ao verificar senha:', err);
    return res.status(500).json({ status: 'erro', mensagem: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('usuarioLogado', COOKIE_OPCOES);
  res.json({ status: 'deslogado' });
};

// "Criar conta" (perfil de cliente)
//  - CPF/e-mail novos: cria a pessoa e o cliente (transação).
//  - Pessoa que já existe (ex.: funcionário): confere a senha e só acrescenta o perfil de cliente.
//    Assim a mesma pessoa tem os dois perfis com o mesmo e-mail (tabelas pessoa, funcionario e cliente).
exports.cadastrarCliente = async (req, res) => {
  const { cpf_pessoa, nome_pessoa, email_pessoa, senha_pessoa, data_nascimento_pessoa, endereco_pessoa } = req.body;
  const cpf = String(cpf_pessoa || '').trim();
  if (!cpfValido(cpf)) return res.status(400).json({ error: 'CPF deve ter exatamente 11 números.' });
  if (cpf === CPF_LOJA_ONLINE) return res.status(400).json({ error: 'CPF inválido.' });
  if (!nome_pessoa || !email_pessoa || !senha_pessoa || !data_nascimento_pessoa || !endereco_pessoa) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (nome_pessoa.trim().length < 3) return res.status(400).json({ error: 'O nome deve ter pelo menos 3 caracteres.' });
  if (dataEhFutura(data_nascimento_pessoa)) return res.status(400).json({ error: 'A data de nascimento não pode ser no futuro.' });
  if (!emailValido(email_pessoa.trim())) return res.status(400).json({ error: 'E-mail inválido.' });
  const email = email_pessoa.trim();

  try {
    // já existe alguém com esse CPF ou com esse e-mail?
    const existe = await db.query(
      'SELECT cpf_pessoa, email_pessoa, senha_pessoa FROM pessoa WHERE cpf_pessoa = $1 OR email_pessoa = $2',
      [cpf, email]
    );

    if (existe.rows.length === 0) {
      // pessoa nova: cria pessoa + cliente
      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [cpf, nome_pessoa.trim(), data_nascimento_pessoa, endereco_pessoa.trim(), senha_pessoa, email]
        );
        await client.query(
          'INSERT INTO cliente (pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente) VALUES ($1, 0, CURRENT_DATE)',
          [cpf]
        );
      });
      return res.status(201).json({ status: 'ok' });
    }

    // pessoa já cadastrada: CPF e e-mail precisam ser da MESMA pessoa
    const pessoa = existe.rows[0];
    if (existe.rows.length > 1 || pessoa.cpf_pessoa !== cpf || pessoa.email_pessoa !== email) {
      return res.status(400).json({ error: 'CPF ou e-mail já cadastrado em outra conta. Confira os dados.' });
    }
    // confirma que é a própria pessoa (senha atual dela)
    if (pessoa.senha_pessoa !== senha_pessoa) {
      return res.status(400).json({ error: 'Este CPF/e-mail já tem cadastro (por exemplo, como funcionário). Para ativar o perfil de cliente, informe a senha atual dessa conta.' });
    }
    const jaCliente = await db.query('SELECT 1 FROM cliente WHERE pessoa_cpf_pessoa = $1', [cpf]);
    if (jaCliente.rows.length > 0) {
      return res.status(400).json({ error: 'Você já tem conta de cliente. Use a aba Entrar.' });
    }
    await db.query('INSERT INTO cliente (pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente) VALUES ($1, 0, CURRENT_DATE)', [cpf]);
    res.status(201).json({ status: 'ok', perfilAdicionado: true });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ===================== RECUPERAÇÃO DE SENHA (por código enviado por e-mail) =====================
const VALIDADE_CODIGO_MIN = 10; // o código vale por 10 minutos
const MAX_TENTATIVAS = 5;       // depois de 5 erros o código é invalidado

// o hash mistura o CPF com o código (no banco não fica o código, só o hash)
function hashCodigo(cpf, codigo) {
  return crypto.createHash('sha256').update(cpf + ':' + codigo).digest('hex');
}

// 1) Pede o código. A resposta é sempre a mesma, exista ou não o e-mail (não revela quem é cliente).
exports.esqueciSenha = async (req, res) => {
  const mensagem = 'Se o e-mail estiver cadastrado, enviamos um código de 6 números. Ele vale por ' + VALIDADE_CODIGO_MIN + ' minutos.';
  try {
    const email = String(req.body.email || '').trim();
    if (!emailValido(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });

    const r = await db.query('SELECT cpf_pessoa, nome_pessoa FROM pessoa WHERE email_pessoa = $1', [email]);
    // o funcionário técnico "online" não faz login, então não recebe recuperação
    if (r.rows.length > 0 && r.rows[0].cpf_pessoa !== CPF_LOJA_ONLINE) {
      const cpf = r.rows[0].cpf_pessoa;
      const codigo = String(crypto.randomInt(100000, 1000000)); // 6 números
      await db.query(
        `UPDATE pessoa SET token_recuperacao_hash = $1,
                token_recuperacao_expira = NOW() + ($2 || ' minutes')::interval,
                token_recuperacao_tentativas = 0
         WHERE cpf_pessoa = $3`,
        [hashCodigo(cpf, codigo), String(VALIDADE_CODIGO_MIN), cpf]   // pedido novo invalida o código anterior
      );
      try {
        await enviarEmail({
          para: email,
          assunto: 'StyleShop - código de recuperação de senha',
          texto: `Olá, ${r.rows[0].nome_pessoa}!\n\nSeu código de verificação é: ${codigo}\n\nEle expira em ${VALIDADE_CODIGO_MIN} minutos.\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\n\nStyleShop`,
          html: `<h2>StyleShop</h2><p>Olá, ${r.rows[0].nome_pessoa.replace(/[<>&]/g, '')}!</p><p>Seu código de verificação é:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${codigo}</p><p>Ele expira em ${VALIDADE_CODIGO_MIN} minutos.</p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`
        });
      } catch (erroEmail) {
        console.error('Falha ao enviar e-mail de recuperação:', erroEmail.message);
      }
    }
    res.json({ status: 'ok', mensagem });
  } catch (error) {
    console.error('Erro em esqueciSenha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// 2) Confere o código e grava a nova senha (o código é de uso único)
exports.redefinirSenha = async (req, res) => {
  const { email, codigo, nova_senha, confirmar_senha } = req.body;
  const erroGenerico = 'Código inválido ou expirado. Confira o código ou peça um novo.';

  if (!emailValido(String(email || '').trim())) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (String(codigo || '').length !== 6 || !/^[0-9]+$/.test(String(codigo))) {
    return res.status(400).json({ error: 'O código deve ter 6 números.' });
  }
  if (!nova_senha || String(nova_senha).length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  if (String(nova_senha).length > 50) return res.status(400).json({ error: 'A nova senha deve ter no máximo 50 caracteres.' });
  if (nova_senha !== confirmar_senha) return res.status(400).json({ error: 'A confirmação da senha não confere.' });

  try {
    const r = await db.query(
      `SELECT cpf_pessoa, token_recuperacao_hash, token_recuperacao_tentativas,
              (token_recuperacao_expira > NOW()) AS dentro_do_prazo
       FROM pessoa WHERE email_pessoa = $1`,
      [String(email).trim()]
    );
    const pessoa = r.rows[0];

    // sem pedido de código, código vencido ou tentativas esgotadas
    if (!pessoa || !pessoa.token_recuperacao_hash || !pessoa.dentro_do_prazo || pessoa.token_recuperacao_tentativas >= MAX_TENTATIVAS) {
      return res.status(400).json({ error: erroGenerico });
    }

    // código errado: conta a tentativa e, na última, invalida o código
    if (hashCodigo(pessoa.cpf_pessoa, String(codigo)) !== pessoa.token_recuperacao_hash) {
      await db.query(
        `UPDATE pessoa SET token_recuperacao_tentativas = token_recuperacao_tentativas + 1 WHERE cpf_pessoa = $1`,
        [pessoa.cpf_pessoa]
      );
      return res.status(400).json({ error: erroGenerico });
    }

    // código certo: troca a senha e apaga o código
    await db.query(
      `UPDATE pessoa SET senha_pessoa = $1, token_recuperacao_hash = NULL,
              token_recuperacao_expira = NULL, token_recuperacao_tentativas = 0
       WHERE cpf_pessoa = $2`,
      [nova_senha, pessoa.cpf_pessoa]
    );
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Erro em redefinirSenha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
