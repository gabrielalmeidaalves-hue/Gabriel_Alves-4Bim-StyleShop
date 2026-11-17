const path = require('path');

// Vitrine pública: o login só é exigido ao finalizar a compra
exports.abrirMenu = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/menu.html'));
};

// Painel administrativo (a rota já é protegida por paginaAdmin)
exports.abrirPainelAdmin = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/admin.html'));
};
