const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('../controllers/produtoController');
const { exigirAdmin, paginaAdmin } = require('../middleware/auth');

// guarda o arquivo na memória para o sharp converter (máximo 5 MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/abrirCrudProduto', paginaAdmin, controller.abrirCrudProduto);
// Vitrine pública: qualquer pessoa pode ver os produtos
router.get('/', controller.listarProdutos);
router.get('/:id', controller.obterProduto);
// CRUD: somente administrador
router.post('/', exigirAdmin, controller.criarProduto);
router.post('/upload/:id', exigirAdmin, upload.single('imagem'), controller.uploadImagem);
router.put('/:id/estoque', exigirAdmin, controller.reporEstoque);
router.put('/:id', exigirAdmin, controller.atualizarProduto);
router.delete('/:id', exigirAdmin, controller.deletarProduto);

module.exports = router;
