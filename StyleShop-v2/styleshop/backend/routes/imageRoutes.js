const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

// Visualizar imagem do produto: público (a vitrine usa)
// O upload da imagem é feito em POST /produto/upload/:id (produtoRoutes)
router.get('/view-image/:produtoId', imageController.viewImage);

module.exports = router;
