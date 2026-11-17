const express = require('express');
const router = express.Router();
const controller = require('../controllers/pessoaController');
const { exigirAdmin, paginaAdmin } = require('../middleware/auth');

// Somente administrador (funcionário)
router.get('/abrirCrudPessoa', paginaAdmin, controller.abrirCrudPessoa);
router.get('/', exigirAdmin, controller.listarPessoas);
router.post('/', exigirAdmin, controller.criarPessoa);
router.get('/:id', exigirAdmin, controller.obterPessoa);
router.put('/:id', exigirAdmin, controller.atualizarPessoa);
router.delete('/:id', exigirAdmin, controller.deletarPessoa);

module.exports = router;
