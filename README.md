# StyleShop - Loja de Roupas

Aplicação web **Cliente/Servidor** (padrão **MVC**) com **Node.js + Express** e **PostgreSQL**, feita para a disciplina de Desenvolvimento Web 1 (DW1) - 4º bimestre 2026.

**Autor:** Gabriel de Almeida Alves | **Turma:** M32 | **Ano:** 2026

A loja funciona como um marketplace simples: qualquer pessoa navega pela vitrine e monta o carrinho; para **pagar**, é preciso fazer **login**. Funcionários/administradores, ao entrarem, ganham acesso às telas de cadastro (CRUDs).

## Funcionalidades

| Visão | O que pode fazer |
|---|---|
| **Visitante** (sem login) | Ver a vitrine, filtrar (categoria, tamanho, cor, preço, estoque), montar o carrinho, criar conta, entrar |
| **Cliente** (login) | Tudo acima + finalizar compra, pagar (simulado) e acompanhar **Meus pedidos** |
| **Administrador** (Gerente, Supervisor ou Diretor) | Tudo acima + painel administrativo e CRUDs: produtos (com imagem e reposição de estoque), categorias, pedidos e itens, pessoas, cargos e formas de pagamento |
| **Outros funcionários** (vendedor, caixa, repositor...) | Sem tela administrativa. Existem no banco para aparecer como vendedor nos pedidos presenciais. Se entrarem no site, são tratados como clientes |

- **Quem é administrador:** só os cargos listados em `backend/config/cargos.js` (`[2, 4, 10]` = Gerente, Supervisor, Diretor). O login calcula `admin` e guarda no cookie; o servidor (`middleware/auth.js`) e o menu usam esse mesmo valor.
- **Mesmo e-mail como funcionário e cliente:** em "Criar conta", se o CPF/e-mail já existe (ex.: funcionário), o sistema pede a senha atual e só acrescenta o perfil de cliente à mesma pessoa.
- **Imagens dos produtos:** clique na imagem no CRUD de produto, escolha o arquivo e salve. O servidor converte para PNG 300x300 (`sharp`) e grava em `imagens/<id>.png`.
- **Reposição de estoque:** no CRUD de produto, o painel "Repor estoque" soma unidades ao estoque (funciona com o estoque zerado).
- **Estoque no carrinho:** o carrinho e a tela de finalizar conferem o estoque atual; o servidor valida de novo no checkout e no pagamento.
- **Frete por distância:** na tela de Finalizar o cliente informa o CEP. O servidor busca o endereço na **BrasilAPI (CEP v2)**, localiza a **rua** no **OpenStreetMap (Nominatim)** e calcula a distância em linha reta até a loja (Campo Mourão - PR) com a fórmula de Haversine. O **limite de entrega é de 100 km** (`RAIO_MAXIMO_KM`, independente da tabela de preços `FAIXAS`, em `backend/config/frete.js`): acima disso o pedido é recusado, no servidor. Preços: até 10 km R$ 10, até 30 km R$ 20, até 60 km R$ 35, até 100 km R$ 50. Se o endereço não puder ser localizado com precisão (rua desconhecida, cidade diferente da do CEP...), o cliente recebe uma mensagem em vez de uma localização chutada; CEP de cidade inteira (sem rua) usa o ponto da cidade e a tela avisa que a distância é aproximada. O frete é recalculado no servidor no checkout e no pagamento e fica gravado em `pedido` (`cep_entrega` e `valor_frete`).
- **Carrinho por usuário:** o carrinho fica no `localStorage`. Ao sair, o carrinho de quem estava logado é guardado com o CPF dele e o carrinho do navegador é limpo; ao entrar, ele é devolvido e junto com o que já houver no carrinho. Assim ninguém perde os itens e outra conta no mesmo navegador não os vê. Ele não é guardado no banco, então não aparece em outro aparelho.
- **Senhas com bcrypt:** cadastro de cliente, cadastro de funcionário/administrador (CRUD de pessoas), recuperação por e-mail e alteração de senha gravam sempre um hash (`backend/utils/senha.js`, biblioteca `bcryptjs`: é o algoritmo bcrypt escrito em JavaScript, com as mesmas funções `hash` e `compare`, sem compilar nada). O login usa `compare`. Contas antigas em texto puro continuam entrando e são migradas sozinhas no primeiro login correto (veja "Migração das senhas"). Alterar a própria senha: `PUT /pessoa/:cpf/senha` com `senha_atual` e `nova_senha` (exige login). No CRUD de pessoas, deixar a senha em branco ao alterar mantém a senha atual.
- **Login/logout com cookie** (`usuarioLogado`, `httpOnly`). O perfil (cliente e/ou funcionário) vem das tabelas `cliente` e `funcionario`.
- **Autorização no servidor** (`backend/middleware/auth.js`): as rotas administrativas respondem `401` (sem login) ou `403` (cliente); as telas redirecionam. Esconder o menu não é a única proteção.
- **Pagamento simulado**: formas vindas do banco, divisão do valor entre mais de uma forma, validação básica de cartão. Dados de cartão não são enviados nem guardados.
- **Recuperação de senha por e-mail** ("Esqueci minha senha" na tela de login): o servidor envia um **código de 6 números** (vale 10 minutos, no máximo 5 tentativas erradas). O usuário digita o código e a nova senha na própria tela, então funciona em qualquer aparelho (não depende de link). No banco fica apenas o **hash SHA-256** do código (colunas `token_recuperacao_hash`, `token_recuperacao_expira` e `token_recuperacao_tentativas` em `pessoa`). A resposta do pedido é sempre a mesma, exista ou não o e-mail, e um novo pedido invalida o código anterior.
- O total é **sempre recalculado no servidor** com os preços do banco, e o CPF do comprador vem do cookie.

## Migração das senhas para bcrypt (bancos que já existem)

Quem já tinha o banco com senhas em texto puro **não perde nenhuma conta**: CPFs, e-mails, pedidos e vínculos cliente/funcionário não mudam.

1. Rode `npm install` (instala o `bcryptjs`).
2. Rode **uma vez**, na pasta do projeto: `npm run migrar-senhas`. O script aumenta a coluna `senha_pessoa` para 255 caracteres (o hash tem 60) e troca cada senha em texto puro por um hash. Quem **já tem hash é pulado**, então ele pode rodar de novo sem estragar nada. (Em vez do script, dá para rodar `documentacao/alter_senha_bcrypt.sql` e deixar a migração acontecer no primeiro login de cada pessoa.)
3. Bancos novos: o `documentacao/styleshop.sql` já traz a coluna com 255 caracteres e as senhas de teste em hash.

Se o código novo for usado antes da migração, o login de quem já tem hash e o de contas antigas continuam funcionando, mas cadastrar/alterar senhas mostra a mensagem "rode npm run migrar-senhas".

## Logins para teste (carga inicial)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador (Gerente) | juliana@email.com | admin123 |
| Administrador (Diretor) | maria@email.com | admin123 |
| Funcionário e cliente | fernanda@email.com | 123456 |
| Cliente | joao@email.com | 123456 |

O funcionário técnico `online` (CPF `00000000000`) apenas registra os pedidos feitos pelo site e **não consegue fazer login**.

## Como executar

1. **Pré-requisitos:** Node.js 18+ e PostgreSQL.
2. **Banco de dados** (pgAdmin/DBeaver ou `psql`):
   ```sql
   CREATE ROLE gabriel WITH LOGIN PASSWORD 'Gabriel';   -- se o usuário ainda não existir
   CREATE DATABASE styleshop OWNER gabriel;
   ```
   Conecte-se ao banco `styleshop` e execute o script `documentacao/styleshop.sql` (cria as tabelas e a carga inicial; pode ser executado de novo).
   Se você já tinha criado o banco antes, rode (só acrescentam/ampliam colunas, não apagam dados) `documentacao/alter_recuperacao_senha.sql` (colunas de recuperação de senha em `pessoa`), `documentacao/alter_frete.sql` (colunas do frete em `pedido`) e depois `npm run migrar-senhas` (veja "Migração das senhas para bcrypt"; o `documentacao/alter_senha_bcrypt.sql` faz só a parte de aumentar a coluna).
3. **Variáveis de ambiente:** copie `.env.example` para `.env` e ajuste se necessário:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=gabriel
   DB_PASSWORD=Gabriel
   DB_NAME=styleshop
   PORT=3001
   ```
   Para o **e-mail de recuperação de senha** preencha também `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (no Gmail, use uma "senha de app"; a porta 465 liga o SSL sozinha). Se ficarem vazios, o link de recuperação é **impresso no terminal** do servidor, o que basta para testar. O `SMTP_FROM` é opcional: se não existir, o remetente é o próprio `SMTP_USER`.
   Ao iniciar, o servidor mostra se o SMTP está configurado. Para testar o envio isoladamente: `npm run testar-email seu@email.com`.
4. **Instalar e iniciar:**
   ```bash
   npm install
   npm start
   ```
5. Abra **http://localhost:3001** (use sempre `localhost`, o mesmo endereço do cookie).

## Estrutura do projeto

```
backend/
  server.js            # Express, rotas e arquivos estáticos
  database.js          # conexão PostgreSQL (lê o .env)
  middleware/auth.js   # cookie -> perfil (cliente / administrador)
  routes/              # mapeamento dos endpoints (Router)
  controllers/         # regras de negócio (Controller)
frontend/              # HTML5 + CSS + JS (View)
  menu.html            # vitrine
  admin.html           # painel administrativo
  login/               # entrar / criar conta
  visaoCliente/        # carrinho, finalizar, pagamento, meus pedidos
  produto/ categoria_roupa/ pedido/ pessoa/ cargo/ forma_pagamento/   # CRUDs (admin)
imagens/               # imagens dos produtos (<id>.png) e silhueta.webp (padrão)
  config/cargos.js     # cargos que acessam a administração (em backend/)
documentacao/styleshop.sql   # DDL + carga inicial
```

## Modelo de dados

```mermaid
erDiagram
    PESSOA ||--o| CLIENTE : "1:1"
    PESSOA ||--o| FUNCIONARIO : "1:1"
    CARGO ||--o{ FUNCIONARIO : "1:N"
    CATEGORIA_ROUPA ||--o{ PRODUTO : "1:N"
    CLIENTE ||--o{ PEDIDO : "1:N"
    FUNCIONARIO ||--o{ PEDIDO : "1:N"
    PEDIDO ||--o{ PEDIDO_HAS_PRODUTO : "itens"
    PRODUTO ||--o{ PEDIDO_HAS_PRODUTO : "itens"
    PEDIDO ||--o| PAGAMENTO : "1:1"
    PAGAMENTO ||--o{ PAGAMENTO_HAS_FORMA_PAGAMENTO : "formas"
    FORMA_PAGAMENTO ||--o{ PAGAMENTO_HAS_FORMA_PAGAMENTO : "formas"

    PESSOA { varchar cpf_pessoa PK
             varchar nome_pessoa
             date data_nascimento_pessoa
             varchar endereco_pessoa
             varchar senha_pessoa "hash bcrypt"
             varchar email_pessoa UK
             varchar token_recuperacao_hash
             timestamp token_recuperacao_expira
             int token_recuperacao_tentativas }
    CARGO { int id_cargo PK
            varchar nome_cargo }
    FUNCIONARIO { varchar pessoa_cpf_pessoa PK,FK
                  double salario_funcionario
                  int cargo_id_cargo FK
                  double porcentagem_comissao_funcionario }
    CLIENTE { varchar pessoa_cpf_pessoa PK,FK
              double renda_cliente
              date data_cadastro_cliente }
    CATEGORIA_ROUPA { varchar id_categoria_roupa PK
                      varchar nome_categoria_roupa }
    PRODUTO { int id_produto PK
              varchar nome_produto
              int quantidade_estoque_produto
              double preco_unitario_produto
              varchar id_categoria_roupa FK
              varchar tamanho
              varchar cor }
    PEDIDO { int id_pedido PK
             date data_pedido
             varchar cliente_pessoa_cpf_pessoa FK
             varchar funcionario_pessoa_cpf_pessoa FK
             varchar cep_entrega
             double valor_frete }
    PEDIDO_HAS_PRODUTO { int produto_id_produto PK,FK
                         int pedido_id_pedido PK,FK
                         int quantidade
                         double preco_unitario }
    FORMA_PAGAMENTO { int id_forma_pagamento PK
                      varchar nome_forma_pagamento }
    PAGAMENTO { int pedido_id_pedido PK,FK
                timestamp data_pagamento
                double valor_total_pagamento }
    PAGAMENTO_HAS_FORMA_PAGAMENTO { int pagamento_id_pedido PK,FK
                                    int forma_pagamento_id_forma_pagamento PK,FK
                                    double valor_pago }
```

- **Independentes:** `pessoa`, `cargo`, `categoria_roupa`, `forma_pagamento`.
- **1:1:** `pessoa-cliente`, `pessoa-funcionario`, `pedido-pagamento`.
- **1:N:** `cargo-funcionario`, `categoria_roupa-produto`, `cliente-pedido`, `funcionario-pedido`.
- **N:N:** `pedido-produto` e `pagamento-forma_pagamento`.

## Fluxo de compra (requisição/resposta)

1. Vitrine (`GET /produto`) -> "Adicionar" grava o carrinho no `localStorage` do navegador.
2. Carrinho -> "Finalizar compra" abre `GET /login/visaoclientefinalizar`. Sem cookie, o servidor redireciona para `/login/?voltar=...`.
3. Login (`POST /login/verificarSenha`) define o cookie e volta para a tela de finalizar.
4. Finalizar -> o cliente digita o CEP e `POST /frete/calcular` devolve cidade, distância e valor do frete (BrasilAPI + OpenStreetMap + Haversine; fora de 100 km é recusado). Só depois disso o botão de pagamento é liberado.
5. `POST /pedido/checkout` calcula o frete de novo, cria `pedido` (com CEP e frete) + `pedido_has_produto` numa transação (valida estoque e usa o preço do banco). O total é produtos + frete.
6. Pagamento -> `POST /pagamento/:idPedido` valida que a soma das formas é igual a produtos + frete, dá baixa no estoque e grava `pagamento` + `pagamento_has_forma_pagamento`, tudo na mesma transação.
7. "Meus pedidos" (`GET /pedido/meus`) mostra o histórico com o frete; pedidos não pagos podem ser pagos ou cancelados.

## Recuperação de senha (fluxo)

1. Em **Entrar**, o link "Esqueci minha senha" abre o campo de e-mail -> `POST /login/esqueci-senha`.
2. O servidor gera um código de 6 números (`crypto.randomInt`), grava o hash, a validade (10 min) e zera as tentativas, e envia o código por e-mail (sem SMTP, o código aparece no terminal do servidor).
3. A tela mostra os campos de código, nova senha e confirmação (mínimo 6 caracteres) -> `POST /login/redefinir-senha`.
4. Se o código estiver certo e dentro do prazo, a senha é trocada e o código é apagado (uso único). Cada código errado conta uma tentativa; ao chegar em 5, o código é invalidado e é preciso pedir outro.

## Observações

- As imagens dos produtos 2 a 10 e 50 existem (`imagens/<id>.png`); os demais usam a `silhueta.webp` até receberem upload (CRUD de produto).
- **Estoque:** em pedidos feitos pelo site, o estoque só diminui quando o pagamento é confirmado. Em **vendas presenciais** (pedido cujo funcionário não é o "online", cadastrado no CRUD de pedidos), os itens mexem no estoque na hora: adicionar baixa, alterar a quantidade ajusta a diferença, apagar o item ou o pedido devolve as unidades. Pedido presencial aparece como "Pago" em "Meus pedidos".
- **Cancelar pedido:** em "Meus pedidos", o cliente pode cancelar um pedido do site que ainda não foi pago (os itens são apagados junto e o estoque não muda).
- **Senhas:** guardadas somente como hash **bcrypt** (custo 10). Nenhuma resposta da API devolve senha ou hash, e a tela de pessoas não mostra nem preenche a senha.
- Repositório: `Gabriel_4bim_StyleShop` (ex.: `Gabriel_4bim_StyleShop`), com o usuário `rjhalmeman@gmail.com` como colaborador.

