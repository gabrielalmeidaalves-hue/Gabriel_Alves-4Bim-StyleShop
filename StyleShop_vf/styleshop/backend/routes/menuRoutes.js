const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { paginaAdmin } = require('../middleware/auth');

// Vitrine pública
router.get('/', menuController.abrirMenu);
// Painel administrativo (somente funcionário)
router.get('/admin', paginaAdmin, menuController.abrirPainelAdmin);

module.exports = router;
