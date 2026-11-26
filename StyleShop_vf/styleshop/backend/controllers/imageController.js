const path = require('path');
const fs = require('fs/promises');

const PASTA_IMAGENS = path.join(__dirname, '..', '..', 'imagens');
const SILHUETA = path.join(PASTA_IMAGENS, 'silhueta.webp');

// Mostra a imagem do produto (imagens/<id>.png).
// Se o produto não tem imagem, mostra a silhueta padrão.
exports.viewImage = async (req, res) => {
  const id = String(req.params.produtoId).replace(/\D/g, '');
  const arquivo = path.join(PASTA_IMAGENS, `${id}.png`);
  try {
    await fs.access(arquivo);
    res.sendFile(arquivo);
  } catch (erro) {
    res.sendFile(SILHUETA);
  }
};
