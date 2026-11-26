const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagamentoController');
const { exigirAdmin, exigirCliente, paginaLogin } = require('../middleware/auth');

// ----- Visão do cliente -----
router.get('/abrirTelaPagamento', paginaLogin, controller.abrirTelaPagamento);
router.post('/:id', exigirCliente, controller.criarPagamentoParaPedido);

// ----- Visão administrativa -----
router.get('/', exigirAdmin, controller.listarPagamentos);
router.get('/:id', exigirAdmin, controller.obterPagamento);
router.put('/:id', exigirAdmin, controller.atualizarPagamento);
router.delete('/:id', exigirAdmin, controller.deletarPagamento);

module.exports = router;
