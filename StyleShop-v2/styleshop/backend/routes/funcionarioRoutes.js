const express = require('express');
const router = express.Router();
const controller = require('../controllers/funcionarioController');
const { exigirAdmin } = require('../middleware/auth');

// Somente administrador (funcionário)
router.get('/', exigirAdmin, controller.listarFuncionarios);
router.post('/', exigirAdmin, controller.criarFuncionario);
router.get('/:id', exigirAdmin, controller.obterFuncionario);
router.put('/:id', exigirAdmin, controller.atualizarFuncionario);
router.delete('/:id', exigirAdmin, controller.deletarFuncionario);

module.exports = router;
