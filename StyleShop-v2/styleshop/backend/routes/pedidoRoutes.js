const express = require('express');
const router = express.Router();
const controller = require('../controllers/pedidoController');
const { exigirAdmin, exigirCliente, paginaAdmin, paginaLogin } = require('../middleware/auth');

// ----- Visão do cliente -----
router.get('/abrirMeusPedidos', paginaLogin, controller.abrirMeusPedidos);
router.get('/meus', exigirCliente, controller.meusPedidos);
router.post('/checkout', exigirCliente, controller.checkout);

// ----- Visão administrativa -----
router.get('/abrirCrudPedido', paginaAdmin, controller.abrirCrudPedido);
router.get('/', exigirAdmin, controller.listarPedidos);
router.post('/gerente', exigirAdmin, controller.criarPedido);
router.get('/:id', exigirAdmin, controller.obterPedido);
router.put('/:id', exigirAdmin, controller.atualizarPedido);
router.delete('/:id', exigirAdmin, controller.deletarPedido);

module.exports = router;
