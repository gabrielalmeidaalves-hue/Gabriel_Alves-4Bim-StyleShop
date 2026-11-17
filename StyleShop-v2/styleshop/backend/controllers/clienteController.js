//import { query } from '../database.js';
const { query } = require('../database');
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

// ===== Fim das validações =====



exports.abrirCrudCliente = (req, res) => {
 // console.log('clienteController - Rota /abrirCrudCliente - abrir o crudCliente');
  res.sendFile(path.join(__dirname, '../../frontend/cliente/cliente.html'));
}

exports.listarClientes = async (req, res) => {
  try {
    const result = await query('SELECT cli.pessoa_cpf_pessoa, p.nome_pessoa,cli.renda_cliente,cli.data_cadastro_cliente FROM cliente cli, pessoa p where cli.pessoa_cpf_pessoa = p.cpf_pessoa ORDER BY cli.pessoa_cpf_pessoa ');
   // console.log('Resultado do SELECT:', result.rows);//verifica se está retornando algo
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


exports.criarCliente = async (req, res) => {
  //  console.log('Criando cliente com dados:', req.body);
  try {
    const { pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente } = req.body;

    if (Number(renda_cliente) < 0) {
      return res.status(400).json({ error: 'A renda não pode ser negativa' });
    }
    if (dataEhFutura(data_cadastro_cliente)) {
      return res.status(400).json({ error: 'A data de cadastro não pode ser no futuro' });
    }

    // Validação básica
    if (!renda_cliente) {
      return res.status(400).json({
        error: 'O nome do cliente é obrigatório'
      });
    }

    const result = await query(
      'INSERT INTO cliente (pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente) VALUES ($1, $2, $3) RETURNING *',
      [pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar cliente:', error);



    // Verifica se é erro de violação de constraint NOT NULL
    if (error.code === '23502') {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.obterCliente = async (req, res) => {
  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)

    // console.log("estou no obter cliente id="+ id);
    if (id.length !== 11) {
      return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
    }

    const result = await query(
      'SELECT * FROM cliente WHERE pessoa_cpf_pessoa = $1',
      [id]
    );

    //console.log(result)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.atualizarCliente = async (req, res) => {

  // console.log('Atualizando cliente com dados:', req.body);

  try {
    const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)
    const { renda_cliente, data_cadastro_cliente } = req.body;

    if (Number(renda_cliente) < 0) {
      return res.status(400).json({ error: 'A renda não pode ser negativa' });
    }
    if (dataEhFutura(data_cadastro_cliente)) {
      return res.status(400).json({ error: 'A data de cadastro não pode ser no futuro' });
    }


    // // Verifica se a cliente existe
    // const existingPersonResult = await query(
    //   'SELECT * FROM cliente WHERE pessoa_cpf_pessoa = $1',
    //   [id]
    // );

    // if (existingPersonResult.rows.length === 0) {
    //   return res.status(404).json({ error: 'Cliente não encontrada' });
    // }

    // Constrói a query de atualização dinamicamente para campos não nulos
    // const dadosDoClienteVindosViaRequisicao = existingPersonResult.rows[0];


    const updatedFields = {
      renda_cliente: renda_cliente,
      data_cadastro_cliente: data_cadastro_cliente
    };

    // Atualiza a cliente
    const updateResult = await query(
      'UPDATE cliente SET renda_cliente = $1, data_cadastro_cliente = $2 WHERE pessoa_cpf_pessoa = $3 RETURNING *',
      [updatedFields.renda_cliente, updatedFields.data_cadastro_cliente, id]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);


    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.deletarCliente = async (req, res) => {
  const id = req.params.id; // CPF fica como texto (parseInt apagaria o zero à esquerda)

  try {

    // 1. Verifica se o cliente existe
    const existingPersonResult = await query(
      'SELECT * FROM cliente WHERE pessoa_cpf_pessoa = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // 2. Deleta o cliente
    await query(
      'DELETE FROM cliente WHERE pessoa_cpf_pessoa = $1',
      [id]
    );

    // 3. Resposta de sucesso (204 No Content - Sem corpo)
    res.status(204).send();

  } catch (error) {

    // console.error('Erro ao deletar cliente:', error);

    // Verifica se é erro de violação de foreign key (código 23503)
    if (error.code === '23503') {
      // Retorna 409 Conflict, que é o mais apropriado para violações de integridade
      return res.status(409).json({
        // Mensagem de erro mais descritiva baseada no detalhe do DB
        error: 'Erro de integridade referencial - o cliente não pode ser excluído, pois está associado a outras entidades (ex: pedidos).'
        // Opcional: detail: error.detail // Você pode enviar o detalhe técnico se precisar no frontend
      });
    }

    // Erros internos inesperados
    res.status(500).json({ error: 'Erro interno do servidor ao tentar excluir o cliente.' });
  }
}


