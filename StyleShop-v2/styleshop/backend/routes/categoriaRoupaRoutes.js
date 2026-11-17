const express = require('express');
const router = express.Router();
const controller = require('../controllers/categoriaRoupaController');
const { exigirAdmin, paginaAdmin } = require('../middleware/auth');

router.get('/abrirCrudCategoriaRoupa', paginaAdmin, controller.abrirCrudCategoriaRoupa);
// Listagem pública (filtros da vitrine)
router.get('/listar', controller.listarCategoriasRoupa);
// CRUD: somente administrador
router.get('/:id', exigirAdmin, controller.obterCategoriaRoupa);
router.post('/', exigirAdmin, controller.criarCategoriaRoupa);
router.put('/:id', exigirAdmin, controller.atualizarCategoriaRoupa);
router.delete('/:id', exigirAdmin, controller.deletarCategoriaRoupa);

module.exports = router;
