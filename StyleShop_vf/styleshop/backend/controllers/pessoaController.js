/*
CREATE TABLE public.pessoa (
  cpf_pessoa varchar(20) NOT NULL,
  nome_pessoa varchar(60) NULL,
  data_nascimento_pessoa date NULL,
  endereco_pessoa varchar(150) NULL,
  senha_pessoa varchar(255) NULL,   -- hash bcrypt (60 caracteres)
  email_pessoa varchar(75) NULL,
  CONSTRAINT pessoa_pkey PRIMARY KEY (cpf_pessoa),
  CONSTRAINT pessoa_unique UNIQUE (email_pessoa)
);
*/
const { query } = require('../database');
const { gerarHash, conferirSenha, colunaPequena, MSG_ATUALIZAR_BANCO } = require('../utils/senha');

// Colunas que podem ir para o navegador. NUNCA incluir senha_pessoa nem as colunas token_recuperacao_*.
const COLUNAS_PESSOA = 'cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, email_pessoa';
// Funções do controller

const path = require('path');

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

// ===== Fim das validações =====



exports.abrirCrudPessoa = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/pessoa/pessoa.html'));
};

exports.listarPessoas = async (req, res) => {
  try {
    const result = await query(`SELECT ${COLUNAS_PESSOA} FROM pessoa ORDER BY cpf_pessoa`);
    // console.log('Resultado do SELECT:', result.rows);//verifica se está retornando algo
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.criarPessoa = async (req, res) => {
  //  console.log('Criando pessoa com dados:', req.body);
  try {
    const { cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa } = req.body;

    // Validação básica
    if (!nome_pessoa || !endereco_pessoa || !senha_pessoa || String(senha_pessoa).trim() === '' || !email_pessoa) {
      return res.status(400).json({
        error: 'Nome, email, endereço e senha são obrigatórios'
      });
    }

    if (!cpfValido(cpf_pessoa)) {
      return res.status(400).json({ error: 'O CPF deve ter exatamente 11 números' });
    }
    if (nome_pessoa.trim().length < 3) {
      return res.status(400).json({ error: 'O nome deve ter pelo menos 3 caracteres' });
    }
    if (dataEhFutura(data_nascimento_pessoa)) {
      return res.status(400).json({ error: 'A data de nascimento não pode ser no futuro' });
    }

    // Validação de email básica
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_pessoa)) {
      return res.status(400).json({
        error: 'Formato de email inválido'
      });
    }

    // a senha é guardada como hash bcrypt (e o hash não volta na resposta)
    const result = await query(
      `INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa,endereco_pessoa,senha_pessoa, email_pessoa ) VALUES ($1, $2, $3, $4, $5,$6) RETURNING ${COLUNAS_PESSOA}`,
      [cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, await gerarHash(senha_pessoa), email_pessoa]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pessoa:', error);
    if (colunaPequena(error)) return res.status(500).json({ error: MSG_ATUALIZAR_BANCO });

    // Verifica se é erro de email duplicado (constraint unique violation)
    if (error.code === '23505' && error.constraint === 'pessoa_unique') {
      return res.status(400).json({
        error: 'Email já está em uso'
      });
    }

    // Verifica se é erro de violação de constraint NOT NULL
    if (error.code === '23502') {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.obterPessoa = async (req, res) => {
  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)

    if (id.length !== 11) {
      return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
    }

    const result = await query(
      `SELECT ${COLUNAS_PESSOA} FROM pessoa WHERE cpf_pessoa = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pessoa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.atualizarPessoa = async (req, res) => {
  //console.log('Atualizando pessoa com dados:', req.body);

  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)
    const { nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa } = req.body;

    if (nome_pessoa && nome_pessoa.trim().length < 3) {
      return res.status(400).json({ error: 'O nome deve ter pelo menos 3 caracteres' });
    }
    // senha em branco = manter a senha atual (o hash nunca é enviado ao navegador); só espaços não vale
    if (senha_pessoa !== undefined && senha_pessoa !== '' && String(senha_pessoa).trim() === '') {
      return res.status(400).json({ error: 'A senha não pode ter só espaços' });
    }
    if (dataEhFutura(data_nascimento_pessoa)) {
      return res.status(400).json({ error: 'A data de nascimento não pode ser no futuro' });
    }

    // Validação de email se fornecido
    if (email_pessoa) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email_pessoa)) {
        return res.status(400).json({
          error: 'Formato de email inválido'
        });
      }
    }
    // Verifica se a pessoa existe
    const existingPersonResult = await query(
      'SELECT * FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }

    // Constrói a query de atualização dinamicamente para campos não nulos
    const currentPerson = existingPersonResult.rows[0];
    const updatedFields = {
      nome_pessoa: nome_pessoa !== undefined ? nome_pessoa : currentPerson.nome_pessoa,
      data_nascimento_pessoa: data_nascimento_pessoa !== undefined ? data_nascimento_pessoa : currentPerson.data_nascimento_pessoa,
      endereco_pessoa: endereco_pessoa !== undefined ? endereco_pessoa : currentPerson.endereco_pessoa,
      // sem senha nova, mantém o hash que já está no banco; com senha nova, gera um hash bcrypt
      senha_pessoa: (senha_pessoa !== undefined && senha_pessoa !== '') ? await gerarHash(senha_pessoa) : currentPerson.senha_pessoa,
      email_pessoa: email_pessoa !== undefined ? email_pessoa : currentPerson.email_pessoa
    };

    //cpf_pessoa, nome_pessoa, data_nascimento_pessoa,endereco_pessoa,senha_pessoa, email_pessoa
    // Atualiza a pessoa
    const updateResult = await query(
      'UPDATE pessoa SET nome_pessoa = $1,  data_nascimento_pessoa = $2, endereco_pessoa = $3, senha_pessoa=$4, email_pessoa=$5  WHERE cpf_pessoa = $6 RETURNING ' + COLUNAS_PESSOA,
      [updatedFields.nome_pessoa, updatedFields.data_nascimento_pessoa, updatedFields.endereco_pessoa, updatedFields.senha_pessoa, updatedFields.email_pessoa, id]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pessoa:', error);
    if (colunaPequena(error)) return res.status(500).json({ error: MSG_ATUALIZAR_BANCO });

    // Verifica se é erro de email duplicado
    if (error.code === '23505' && error.constraint === 'pessoa_unique') {
      return res.status(400).json({
        error: 'Email já está em uso por outra pessoa'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.deletarPessoa = async (req, res) => {
  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)
    // Verifica se a pessoa existe
    const existingPersonResult = await query(
      'SELECT * FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }

    // Deleta a pessoa (as constraints CASCADE cuidarão das dependências)
    await query(
      'DELETE FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar pessoa:', error);

    // Verifica se é erro de violação de foreign key (dependências)
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Não é possível deletar pessoa com dependências associadas (essa pessoa é cliente ou funcionário)'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função adicional para buscar pessoa por email
exports.obterPessoaPorEmail = async (req, res) => {
  try {
    const { email_pessoa } = req.params;

    if (!email_pessoa) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const result = await query(
      `SELECT ${COLUNAS_PESSOA} FROM pessoa WHERE email_pessoa = $1`,
      [email_pessoa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pessoa por email:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Alterar a PRÓPRIA senha: confere a senha atual e grava a nova como hash bcrypt.
// Rota: PUT /pessoa/:id/senha (exige login; cada pessoa só altera a senha do próprio CPF)
exports.atualizarSenha = async (req, res) => {
  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)
    const { senha_atual, nova_senha } = req.body;

    if (id.length !== 11) {
      return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
    }
    if (!req.usuario || req.usuario.cpf_pessoa !== id) {
      return res.status(403).json({ error: 'Você só pode alterar a sua própria senha' });
    }
    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }
    if (String(nova_senha).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }
    if (String(nova_senha).length > 50) {
      return res.status(400).json({ error: 'A nova senha deve ter no máximo 50 caracteres' });
    }

    // Verifica se a pessoa existe e se a senha atual está correta (bcrypt)
    const personResult = await query('SELECT senha_pessoa FROM pessoa WHERE cpf_pessoa = $1', [id]);
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }
    if (!(await conferirSenha(senha_atual, personResult.rows[0].senha_pessoa))) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Atualiza apenas a senha, já como hash (o hash não volta na resposta)
    const updateResult = await query(
      'UPDATE pessoa SET senha_pessoa = $1 WHERE cpf_pessoa = $2 RETURNING cpf_pessoa, nome_pessoa',
      [await gerarHash(nova_senha), id]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    if (colunaPequena(error)) return res.status(500).json({ error: MSG_ATUALIZAR_BANCO });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
