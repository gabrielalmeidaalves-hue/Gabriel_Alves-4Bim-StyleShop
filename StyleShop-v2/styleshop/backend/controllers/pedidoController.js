//import { query } from '../database.js';
const { query, transaction } = require('../database');
// Funções do controller

const path = require('path');

exports.abrirCrudPedido = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/pedido/pedido.html'));
};

exports.listarPedidos = async (req, res) => {
  try {
    const result = await query(`SELECT p.*, pc.nome_pessoa AS nome_cliente, pf.nome_pessoa AS nome_funcionario
       FROM pedido p
       JOIN pessoa pc ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
       JOIN pessoa pf ON pf.cpf_pessoa = p.funcionario_pessoa_cpf_pessoa
       ORDER BY p.id_pedido`);
    //  console.log('Resultado do SELECT:', result.rows);//verifica se está retornando algo
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


exports.criarPedido = async (req, res) => {
    console.log('Criando pedido visao gerente com dados:', req.body);
  try {
    const { id_pedido, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa } = req.body;
    if (id_pedido && (isNaN(parseInt(id_pedido, 10)) || parseInt(id_pedido, 10) < 1)) {
      return res.status(400).json({ error: 'O ID deve ser um número maior que zero' });
    }

    const result = await query(
      // se o ID não for informado, a sequence gera o próximo
      `INSERT INTO pedido (id_pedido, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa)
       VALUES (COALESCE($1, nextval('public.pedido_id_pedido_seq')), $2, $3, $4) RETURNING *`,
      [id_pedido ? parseInt(id_pedido, 10) : null, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pedido:', error);



    // Verifica se é erro de violação de constraint NOT NULL
    if (error.code === '23502') {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// FUNÇÃO 2: CRIAR PEDIDO ONLINE (E-COMMERCE - Utiliza CPF de Funcionário Padrão)
exports.obterPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // console.log("estou no obter pedido id="+ id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID deve ser um número válido' });
    }

    const result = await query(
      `SELECT p.*, pc.nome_pessoa AS nome_cliente, pf.nome_pessoa AS nome_funcionario
       FROM pedido p
       JOIN pessoa pc ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
       JOIN pessoa pf ON pf.cpf_pessoa = p.funcionario_pessoa_cpf_pessoa
       WHERE p.id_pedido = $1`,
      [id]
    );

    //console.log(result)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pedido:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.atualizarPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa } = req.body;

    // Verifica se o pedido existe
    const existing = await query('SELECT * FROM pedido WHERE id_pedido = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    // Atualiza o pedido
    const sql = `
      UPDATE pedido
      SET data_pedido = $1,
          cliente_pessoa_cpf_pessoa = $2,
          funcionario_pessoa_cpf_pessoa = $3
      WHERE id_pedido = $4
      RETURNING *
    `;
    const values = [data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, id];

    const updateResult = await query(sql, values);
    return res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};


exports.deletarPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Verifica se a pedido existe
    const existingPersonResult = await query(
      'SELECT * FROM pedido WHERE id_pedido = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrada' });
    }

    // Deleta a pedido (as constraints CASCADE cuidarão das dependências)
    await query(
      'DELETE FROM pedido WHERE id_pedido = $1',
      [id]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar pedido:', error);

    // Verifica se é erro de violação de foreign key (dependências)
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Não é possível deletar pedido com dependências associadas'
      });
    }

    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}




// ===================== VISÃO DO CLIENTE =====================
const CPF_LOJA_ONLINE = '00000000000';

exports.abrirMeusPedidos = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/visaoCliente/meuspedidos/meuspedidos.html'));
};

// Cria o pedido + itens em uma única transação.
// O CPF vem do cookie (não do corpo da requisição) e o preço vem do banco (não do navegador).
exports.checkout = async (req, res) => {
  try {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (itens.length === 0) return res.status(400).json({ error: 'O carrinho está vazio.' });

    const agrupado = new Map();
    for (const it of itens) {
      const id = parseInt(it.id_produto, 10);
      const qtd = parseInt(it.quantidade, 10);
      if (!Number.isInteger(id) || !Number.isInteger(qtd) || qtd <= 0) {
        return res.status(400).json({ error: 'Item inválido no carrinho.' });
      }
      agrupado.set(id, (agrupado.get(id) || 0) + qtd);
    }

    const resultado = await transaction(async (client) => {
      const ped = await client.query(
        `INSERT INTO pedido (id_pedido, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa)
         VALUES (DEFAULT, CURRENT_DATE, $1, $2) RETURNING id_pedido`,
        [req.usuario.cpf_pessoa, CPF_LOJA_ONLINE]
      );
      const idPedido = ped.rows[0].id_pedido;
      let total = 0;
      for (const [idProduto, qtd] of agrupado) {
        const prod = await client.query(
          'SELECT nome_produto, preco_unitario_produto, quantidade_estoque_produto FROM produto WHERE id_produto = $1',
          [idProduto]
        );
        if (prod.rows.length === 0) throw { http: 400, msg: `Produto ${idProduto} não existe mais.` };
        const p = prod.rows[0];
        if (p.quantidade_estoque_produto < qtd) {
          throw { http: 409, msg: `Estoque insuficiente para "${p.nome_produto}" (restam ${p.quantidade_estoque_produto}).` };
        }
        await client.query(
          'INSERT INTO pedido_has_produto (produto_id_produto, pedido_id_pedido, quantidade, preco_unitario) VALUES ($1,$2,$3,$4)',
          [idProduto, idPedido, qtd, p.preco_unitario_produto]
        );
        total += qtd * p.preco_unitario_produto;
      }
      return { id_pedido: idPedido, valor_total: Math.round(total * 100) / 100 };
    });
    res.status(201).json(resultado);
  } catch (error) {
    if (error && error.http) return res.status(error.http).json({ error: error.msg });
    console.error('Erro no checkout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Pedidos do cliente logado (com itens e situação do pagamento)
exports.meusPedidos = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id_pedido, p.data_pedido,
              (pg.pedido_id_pedido IS NOT NULL) AS pago,
              COALESCE(SUM(i.quantidade * i.preco_unitario), 0) AS total,
              COALESCE(json_agg(json_build_object(
                  'id_produto', pr.id_produto, 'nome', pr.nome_produto, 'tamanho', pr.tamanho, 'cor', pr.cor,
                  'quantidade', i.quantidade, 'preco', i.preco_unitario))
                  FILTER (WHERE i.produto_id_produto IS NOT NULL), '[]') AS itens
       FROM pedido p
       LEFT JOIN pedido_has_produto i ON i.pedido_id_pedido = p.id_pedido
       LEFT JOIN produto pr ON pr.id_produto = i.produto_id_produto
       LEFT JOIN pagamento pg ON pg.pedido_id_pedido = p.id_pedido
       WHERE p.cliente_pessoa_cpf_pessoa = $1
       GROUP BY p.id_pedido, p.data_pedido, pg.pedido_id_pedido
       ORDER BY p.id_pedido DESC`,
      [req.usuario.cpf_pessoa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar meus pedidos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
