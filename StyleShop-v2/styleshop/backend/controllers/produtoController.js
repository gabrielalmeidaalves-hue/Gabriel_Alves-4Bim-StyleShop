const { query } = require('../database');
const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp'); // converte qualquer imagem para PNG 300x300

// Tamanhos aceitos (a mesma lista está em frontend/produto/produto.js e frontend/js/menu.js)
const TAMANHOS = [
  'PP', 'P', 'M', 'G', 'GG', 'XG', 'Único',
  '34', '36', '38', '40', '42', '44', '46',
  '2', '4', '6', '8', '10', '12', '14'
];
const PASTA_IMAGENS = path.join(__dirname, '..', '..', 'imagens');

exports.abrirCrudProduto = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/produto/produto.html'));
};

// SELECT com o nome da categoria (JOIN) - usado pela vitrine e pelo CRUD
const SQL_BASE = `
  SELECT p.*, c.nome_categoria_roupa
  FROM produto p
  JOIN categoria_roupa c ON c.id_categoria_roupa = p.id_categoria_roupa`;

exports.listarProdutos = async (req, res) => {
  try {
    const result = await query(SQL_BASE + ' ORDER BY p.id_produto');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.obterProduto = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID deve ser um número válido' });
    const result = await query(SQL_BASE + ' WHERE p.id_produto = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

function validar(b) {
  const nome = String(b.nome_produto || '').trim();
  const estoque = Number(String(b.quantidade_estoque_produto).replace(',', '.'));
  const preco = Number(String(b.preco_unitario_produto).replace(',', '.'));
  const categoria = String(b.id_categoria_roupa || '').trim().toUpperCase();
  const tamanho = String(b.tamanho || '').trim();
  const cor = String(b.cor || '').trim();
  if (!nome) return { erro: 'O nome do produto é obrigatório' };
  if (!Number.isInteger(estoque) || estoque < 0) return { erro: 'Estoque deve ser um inteiro maior ou igual a zero' };
  if (!Number.isFinite(preco) || preco < 0) return { erro: 'Preço deve ser um número maior ou igual a zero' };
  if (!categoria) return { erro: 'A categoria é obrigatória' };
  if (!tamanho) return { erro: 'O tamanho é obrigatório' };
  if (!TAMANHOS.includes(tamanho)) return { erro: 'Tamanho inválido. Escolha um da lista.' };
  if (!cor) return { erro: 'A cor é obrigatória' };
  return { nome, estoque, preco, categoria, tamanho, cor };
}

exports.criarProduto = async (req, res) => {
  try {
    const v = validar(req.body);
    if (v.erro) return res.status(400).json({ error: v.erro });
    // se o ID não for informado, a sequence gera automaticamente
    const idInformado = req.body.id_produto ? parseInt(req.body.id_produto, 10) : null;
    if (idInformado !== null && (isNaN(idInformado) || idInformado < 1)) {
      return res.status(400).json({ error: 'O ID deve ser um número maior que zero' });
    }
    const result = await query(
      `INSERT INTO produto (id_produto, nome_produto, quantidade_estoque_produto, preco_unitario_produto, id_categoria_roupa, tamanho, cor)
       VALUES (COALESCE($1, nextval('public.produto_id_produto_seq')), $2, $3, $4, $5, $6, $7) RETURNING *`,
      [idInformado, v.nome, v.estoque, v.preco, v.categoria, v.tamanho, v.cor]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    if (error.code === '23505') return res.status(400).json({ error: 'Já existe produto com esse ID' });
    if (error.code === '23503') return res.status(400).json({ error: 'Categoria não encontrada' });
    if (error.code === '23502') return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.atualizarProduto = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const v = validar(req.body);
    if (v.erro) return res.status(400).json({ error: v.erro });
    const result = await query(
      `UPDATE produto SET nome_produto=$1, quantidade_estoque_produto=$2, preco_unitario_produto=$3,
              id_categoria_roupa=$4, tamanho=$5, cor=$6 WHERE id_produto=$7 RETURNING *`,
      [v.nome, v.estoque, v.preco, v.categoria, v.tamanho, v.cor, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    if (error.code === '23503') return res.status(400).json({ error: 'Categoria não encontrada' });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.deletarProduto = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const r = await query('DELETE FROM produto WHERE id_produto = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    // apaga a imagem (se existir)
    await fs.unlink(path.join(PASTA_IMAGENS, `${id}.png`)).catch(() => {});
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Não é possível excluir: o produto já foi vendido em pedidos.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Upload da imagem do produto (mesmo método do projeto LojaRoupas):
// recebe o arquivo, converte para PNG 300x300 e salva em imagens/<id>.png
exports.uploadImagem = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
    if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'Nenhum arquivo enviado.' });

    // só aceita imagem para produto que existe
    const existe = await query('SELECT 1 FROM produto WHERE id_produto = $1', [id]);
    if (existe.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });

    await fs.mkdir(PASTA_IMAGENS, { recursive: true });
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .toFormat('png')
      .toFile(path.join(PASTA_IMAGENS, `${id}.png`));

    res.json({ sucesso: true, mensagem: 'Imagem salva com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar imagem:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Arquivo inválido ou erro ao processar a imagem.' });
  }
};

// Repor estoque: SOMA unidades ao estoque atual (funciona também quando o estoque está em 0)
exports.reporEstoque = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const quantidade = Number(req.body.quantidade);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ error: 'Informe uma quantidade inteira maior que zero.' });
    }
    const result = await query(
      `UPDATE produto SET quantidade_estoque_produto = quantidade_estoque_produto + $1
       WHERE id_produto = $2 RETURNING id_produto, nome_produto, quantidade_estoque_produto`,
      [quantidade, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao repor estoque:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
