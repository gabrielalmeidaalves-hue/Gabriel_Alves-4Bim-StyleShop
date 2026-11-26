const express = require('express');
const router = express.Router();
const controller = require('../controllers/forma_pagamentoController');
const { exigirLogin, exigirAdmin, paginaAdmin } = require('../middleware/auth');

router.get('/abrirCrudForma_pagamento', paginaAdmin, controller.abrirCrudForma_pagamento);
// Listar: qualquer usuário logado (a tela de pagamento do cliente usa)
router.get('/', exigirLogin, controller.listarForma_pagamento);
// Alterar: somente administrador
router.post('/', exigirAdmin, controller.criarForma_pagamento);
router.get('/:id', exigirAdmin, controller.obterForma_pagamento);
router.put('/:id', exigirAdmin, controller.atualizarForma_pagamento);
router.delete('/:id', exigirAdmin, controller.deletarForma_pagamento);

module.exports = router;
