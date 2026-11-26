const express = require('express');
const router = express.Router();
const controller = require('../controllers/clienteController');
const { exigirAdmin } = require('../middleware/auth');

// Somente administrador (funcionário)
router.get('/', exigirAdmin, controller.listarClientes);
router.post('/', exigirAdmin, controller.criarCliente);
router.get('/:id', exigirAdmin, controller.obterCliente);
router.put('/:id', exigirAdmin, controller.atualizarCliente);
router.delete('/:id', exigirAdmin, controller.deletarCliente);

module.exports = router;
