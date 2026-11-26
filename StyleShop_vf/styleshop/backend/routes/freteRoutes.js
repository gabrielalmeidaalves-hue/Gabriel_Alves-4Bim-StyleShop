const express = require('express');
const router = express.Router();
const freteController = require('../controllers/freteController');

// Calcular o frete não depende de login (como em outros sites de compra)
router.post('/calcular', freteController.calcular);

module.exports = router;
