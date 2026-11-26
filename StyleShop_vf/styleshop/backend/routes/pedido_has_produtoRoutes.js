const express = require('express');
const router = express.Router();
const controller = require('../controllers/pedido_has_produtoController');
const { exigirAdmin } = require('../middleware/auth');

// Itens do pedido: somente administrador
router.use(exigirAdmin);
router.get('/', controller.listarPedido_has_produtos);
router.post('/', controller.criarPedido_has_produto);
router.post('/lote', controller.criarItensPedidoEmLote);
router.get('/:id_pedido/:id_produto', controller.obterPedido_has_produto);
router.put('/:id_pedido/:id_produto', controller.atualizarPedido_has_produto);
router.delete('/:id_pedido/:id_produto', controller.deletarPedido_has_produto);
router.get('/:idPedido', controller.obterItensDeUmPedido_has_produto);

module.exports = router;
