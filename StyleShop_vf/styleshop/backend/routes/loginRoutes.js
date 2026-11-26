const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');
const { paginaLogin } = require('../middleware/auth');

router.get('/', loginController.abrirTelaLogin);
router.get('/visaocliente', loginController.abrirVisaoCliente);
router.get('/visaoclientecarrinho', loginController.abrirVisaoClienteCarrinho);
// Finalizar compra: exige login
router.get('/visaoclientefinalizar', paginaLogin, loginController.abrirVisaoClienteFinalizar);

router.post('/verificarSenha', loginController.verificarSenha);
router.post('/cadastrar', loginController.cadastrarCliente);
router.get('/verificaSeUsuarioEstaLogado', loginController.verificaSeUsuarioEstaLogado);
router.get('/logout', loginController.logout);

// Recuperação de senha (rotas públicas)
router.post('/esqueci-senha', loginController.esqueciSenha);      // envia o código por e-mail
router.post('/redefinir-senha', loginController.redefinirSenha);  // confere o código e troca a senha

module.exports = router;
