// Senhas com bcrypt.
// Usamos a biblioteca "bcryptjs": é o mesmo algoritmo bcrypt (mesmas funções hash e compare e o mesmo
// formato de hash "$2b$10$..."), escrita só em JavaScript, então instala em qualquer computador.
const bcrypt = require('bcryptjs');

const CUSTO = 10; // quanto maior, mais lento (e mais seguro) é gerar/conferir o hash

// true se o texto já é um hash bcrypt: começa com $2a$, $2b$ ou $2y$ e tem 60 caracteres
function ehHash(texto) {
  return typeof texto === 'string' && /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(texto);
}

// Gera o hash que vai para o banco (nunca guardamos a senha em texto puro)
async function gerarHash(senha) {
  return bcrypt.hash(String(senha), CUSTO);
}

// Confere a senha digitada com a que está guardada no banco.
// - guardada como hash bcrypt: usa bcrypt.compare
// - guardada em texto puro (conta antiga, ainda não migrada): compara o texto; o login então
//   troca por um hash (veja verificarSenha em loginController.js)
async function conferirSenha(senhaDigitada, guardada) {
  if (ehHash(guardada)) {
    return bcrypt.compare(String(senhaDigitada), guardada);
  }
  return typeof guardada === 'string' && String(senhaDigitada) === guardada;
}

// Erro 22001 do PostgreSQL = "valor longo demais para a coluna": o banco ainda tem senha_pessoa com 50
// caracteres e o hash bcrypt (60) não cabe. A solução é rodar a migração uma vez.
function colunaPequena(erro) {
  return !!erro && erro.code === '22001';
}
const MSG_ATUALIZAR_BANCO = 'O banco ainda não foi atualizado para bcrypt. Rode no terminal, na pasta do projeto: npm run migrar-senhas';

module.exports = { ehHash, gerarHash, conferirSenha, colunaPequena, MSG_ATUALIZAR_BANCO };
