// Migração única das senhas para bcrypt:  npm run migrar-senhas
// - aumenta a coluna senha_pessoa para 255 caracteres (o hash bcrypt tem 60)
// - troca cada senha em TEXTO PURO por um hash bcrypt
// - quem já tem hash bcrypt é PULADO (assim o script pode rodar mais de uma vez sem estragar nada)
// Ninguém precisa criar conta de novo: CPF, e-mail, pedidos e vínculos continuam iguais.
const db = require('./database');
const { ehHash, gerarHash } = require('./utils/senha');

async function migrar() {
  // a coluna precisa caber o hash (se já tiver 255, este comando não muda nada)
  await db.query('ALTER TABLE public.pessoa ALTER COLUMN senha_pessoa TYPE character varying(255)');

  const r = await db.query('SELECT cpf_pessoa, senha_pessoa FROM pessoa ORDER BY cpf_pessoa');
  let migradas = 0;
  let puladas = 0;

  for (const pessoa of r.rows) {
    if (ehHash(pessoa.senha_pessoa)) {
      puladas++;   // já é hash bcrypt: não mexe
      continue;
    }
    if (!pessoa.senha_pessoa) {
      console.log('Aviso: CPF ' + pessoa.cpf_pessoa + ' está sem senha (ignorado).');
      continue;
    }
    await db.query('UPDATE pessoa SET senha_pessoa = $1 WHERE cpf_pessoa = $2', [await gerarHash(pessoa.senha_pessoa), pessoa.cpf_pessoa]);
    migradas++;
  }

  console.log('Senhas migradas para bcrypt: ' + migradas);
  console.log('Senhas que já eram hash (não alteradas): ' + puladas);
}

migrar()
  .then(() => db.pool.end())
  .catch(async (erro) => {
    console.error('Falha na migração:', erro.message);
    await db.pool.end();
    process.exit(1);
  });
