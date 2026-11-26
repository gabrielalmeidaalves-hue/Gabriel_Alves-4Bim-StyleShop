// Cargos que podem acessar a ADMINISTRAÇÃO do site (id_cargo da tabela cargo).
// Os demais cargos (vendedor, caixa, repositor...) existem para registrar quem fez a venda
// presencial, mas não têm nenhuma tela administrativa.
//   2 = Gerente   4 = Supervisor   10 = Diretor
const CARGOS_ADMIN = [2, 4, 10];

module.exports = { CARGOS_ADMIN };
