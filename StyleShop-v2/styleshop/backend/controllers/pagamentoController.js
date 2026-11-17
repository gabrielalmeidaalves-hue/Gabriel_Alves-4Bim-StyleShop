//import { query } from '../database.js';
const { query, transaction } = require('../database');
// Funções do controller

const path = require('path');

exports.abrirTelaPagamento = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/visaoCliente/pagamento/pagamento.html'));
};


exports.listarPagamentos = async (req, res) => {
  try {
    const result = await query('SELECT * FROM pagamento ORDER BY pedido_id_pedido');
    //  console.log('Resultado do SELECT:', result.rows);//verifica se está retornando algo
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


exports.criarPagamento = async (req, res) => {
  try {
    const { pedido_id_pedido, data_pagamento, valor_total_pagamento } = req.body;

    if (!pedido_id_pedido) {
      return res.status(400).json({ error: 'O pedido do pagamento é obrigatório' });
    }

    const result = await query(
      'INSERT INTO pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento) VALUES ($1, COALESCE($2, NOW()), $3) RETURNING *',
      [pedido_id_pedido, data_pagamento || null, valor_total_pagamento]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    if (error.code === '23502') return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    if (error.code === '23503') return res.status(400).json({ error: 'Pedido não encontrado' });
    if (error.code === '23505') return res.status(409).json({ error: 'Esse pedido já tem pagamento' });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.criarPagamentoParaPedido = async (req, res) => {
  try {
    const idPedido = parseInt(req.params.id, 10);
    const { formasPagamento } = req.body;
    if (isNaN(idPedido)) return res.status(400).json({ error: 'ID do pedido inválido' });
    if (!Array.isArray(formasPagamento) || formasPagamento.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos uma forma de pagamento' });
    }

    // soma por forma de pagamento (o mesmo tipo escolhido duas vezes vira uma linha só)
    const porForma = {};
    for (const f of formasPagamento) {
      const idForma = parseInt(f.tipo, 10);
      const valor = parseFloat(f.valor);
      if (isNaN(idForma) || !(valor > 0)) return res.status(400).json({ error: 'Forma de pagamento inválida' });
      porForma[idForma] = Math.round(((porForma[idForma] || 0) + valor) * 100) / 100;
    }

    const resultado = await transaction(async (client) => {
      // o pedido precisa ser do cliente logado
      const ped = await client.query(
        'SELECT 1 FROM pedido WHERE id_pedido = $1 AND cliente_pessoa_cpf_pessoa = $2',
        [idPedido, req.usuario.cpf_pessoa]
      );
      if (ped.rows.length === 0) throw { http: 404, msg: 'Pedido não encontrado.' };

      const itens = await client.query(
        `SELECT i.produto_id_produto AS id_produto, i.quantidade, i.preco_unitario, p.nome_produto
         FROM pedido_has_produto i JOIN produto p ON p.id_produto = i.produto_id_produto
         WHERE i.pedido_id_pedido = $1`, [idPedido]);
      if (itens.rows.length === 0) throw { http: 400, msg: 'Pedido sem itens.' };

      // o valor total é calculado aqui, a partir do banco (não confiamos no navegador)
      const total = Math.round(itens.rows.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0) * 100) / 100;
      const pago = Object.values(porForma).reduce((s, v) => s + v, 0);
      if (Math.abs(pago - total) > 0.009) {
        throw { http: 400, msg: `A soma das formas de pagamento (R$ ${pago.toFixed(2)}) difere do total (R$ ${total.toFixed(2)}).` };
      }

      // baixa no estoque (só ocorre se ainda houver quantidade)
      for (const i of itens.rows) {
        const baixa = await client.query(
          `UPDATE produto SET quantidade_estoque_produto = quantidade_estoque_produto - $1
           WHERE id_produto = $2 AND quantidade_estoque_produto >= $1`, [i.quantidade, i.id_produto]);
        if (baixa.rowCount === 0) throw { http: 409, msg: `Estoque insuficiente para "${i.nome_produto}".` };
      }

      const pagamento = await client.query(
        'INSERT INTO pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento) VALUES ($1, NOW(), $2) RETURNING *',
        [idPedido, total]
      );
      for (const [idForma, valorPago] of Object.entries(porForma)) {
        await client.query(
          `INSERT INTO pagamento_has_forma_pagamento (pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago)
           VALUES ($1, $2, $3)`, [idPedido, idForma, valorPago]);
      }
      return pagamento.rows[0];
    });
    res.status(201).json({ sucesso: true, message: 'Pagamento registrado com sucesso', pagamento: resultado });
  } catch (error) {
    if (error && error.http) return res.status(error.http).json({ sucesso: false, error: error.msg });
    console.error('Erro ao criar pagamento:', error);
    if (error.code === '23505') return res.status(400).json({ error: 'Esse pedido já possui pagamento' });
    if (error.code === '23503') return res.status(400).json({ error: 'Forma de pagamento não encontrada' });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.obterPagamento = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID deve ser um número válido' });
    }
    const result = await query('SELECT * FROM pagamento WHERE pedido_id_pedido = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.atualizarPagamento = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data_pagamento, valor_total_pagamento } = req.body;
    const result = await query(
      'UPDATE pagamento SET data_pagamento = COALESCE($1, data_pagamento), valor_total_pagamento = COALESCE($2, valor_total_pagamento) WHERE pedido_id_pedido = $3 RETURNING *',
      [data_pagamento || null, valor_total_pagamento ?? null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

exports.deletarPagamento = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await query('SELECT 1 FROM pagamento WHERE pedido_id_pedido = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    await query('DELETE FROM pagamento WHERE pedido_id_pedido = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar pagamento:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Não é possível deletar pagamento com formas de pagamento associadas' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}