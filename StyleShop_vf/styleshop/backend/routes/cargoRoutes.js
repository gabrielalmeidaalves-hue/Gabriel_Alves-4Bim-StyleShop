const express = require('express');
const router = express.Router();
const controller = require('../controllers/cargoController');
const { exigirAdmin, paginaAdmin } = require('../middleware/auth');

// Somente administrador (funcionário)
router.get('/abrirCrudCargo', paginaAdmin, controller.abrirCrudCargo);
router.get('/', exigirAdmin, controller.listarCargos);
router.post('/', exigirAdmin, controller.criarCargo);
router.get('/:id', exigirAdmin, controller.obterCargo);
router.put('/:id', exigirAdmin, controller.atualizarCargo);
router.delete('/:id', exigirAdmin, controller.deletarCargo);

module.exports = router;
