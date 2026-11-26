-- ============================================================
-- StyleShop - SCRIPT ÚNICO CONSOLIDADO (PostgreSQL)
-- Pode ser usado para inicializar a estrutura em um banco vazio
-- ou complementar um banco StyleShop existente com a MESMA estrutura.
-- NÃO contém DROP, TRUNCATE, RESTART IDENTITY ou exclusão de registros.
-- Sequências existentes não são removidas nem têm seu vínculo alterado.
-- Faça backup antes de executar em um banco com dados.
-- ============================================================
BEGIN;

-- ============================================================
-- StyleShop - Loja de Roupas
-- Projeto DW1 - 4º bimestre 2026
-- Aluno: Gabriel de Almeida Alves | Turma: M32 | 2026
-- Owner: gabriel
--
-- Conecte-se ao banco styleshop antes de executar.
-- Script consolidado para a estrutura StyleShop: cria o que faltar,
-- atualiza os campos novos e preserva registros já existentes. NÃO apaga tabelas/dados/sequências.
--
-- Relacionamentos:
--   Independentes : pessoa, cargo, categoria_roupa, forma_pagamento
--   1:1           : pessoa-cliente, pessoa-funcionario, pedido-pagamento
--   1:N           : cargo-funcionario, categoria_roupa-produto,
--                   cliente-pedido, funcionario-pedido
--   N:N           : pedido-produto (pedido_has_produto),
--                   pagamento-forma_pagamento (pagamento_has_forma_pagamento)
--
-- Login: o e-mail + senha de qualquer pessoa. Quem tem registro na
-- tabela funcionario acessa a visão administrativa; os demais, a visão do cliente.
-- ============================================================

-- ============================================================
-- 1. ESTRUTURA (sem DROP TABLE / sem exclusão de dados)
-- ============================================================

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- Pessoa (independente)
CREATE TABLE IF NOT EXISTS public.pessoa (
    cpf_pessoa character varying(20) NOT NULL PRIMARY KEY,
    nome_pessoa character varying(60) NOT NULL,
    data_nascimento_pessoa date NOT NULL,
    endereco_pessoa character varying(150) NOT NULL,
    senha_pessoa character varying(255) NOT NULL,   -- hash bcrypt (60 caracteres), nunca a senha em texto puro
    email_pessoa character varying(75) NOT NULL,
    -- recuperação de senha: hash SHA-256 do código de 6 números enviado por e-mail, validade e nº de tentativas erradas
    token_recuperacao_hash character varying(64),
    token_recuperacao_expira timestamp without time zone,
    token_recuperacao_tentativas integer NOT NULL DEFAULT 0,
    CONSTRAINT pessoa_unique UNIQUE (email_pessoa)
);

-- Cargo (independente)
CREATE SEQUENCE IF NOT EXISTS public.cargo_id_cargo_seq;
CREATE TABLE IF NOT EXISTS public.cargo (
    id_cargo integer PRIMARY KEY DEFAULT nextval('public.cargo_id_cargo_seq'),
    nome_cargo character varying(45) NOT NULL
);

-- Categoria de roupa (independente) - o id é uma sigla de até 4 letras
CREATE TABLE IF NOT EXISTS public.categoria_roupa (
    id_categoria_roupa character varying(4) NOT NULL PRIMARY KEY,
    nome_categoria_roupa character varying(50) NOT NULL
);

-- Forma de pagamento (independente)
CREATE SEQUENCE IF NOT EXISTS public.forma_pagamento_id_forma_pagamento_seq;
CREATE TABLE IF NOT EXISTS public.forma_pagamento (
    id_forma_pagamento integer PRIMARY KEY DEFAULT nextval('public.forma_pagamento_id_forma_pagamento_seq'),
    nome_forma_pagamento character varying(100) NOT NULL
);

-- Funcionario (1:1 com pessoa, N:1 com cargo)
CREATE TABLE IF NOT EXISTS public.funcionario (
    pessoa_cpf_pessoa character varying(20) NOT NULL PRIMARY KEY,
    salario_funcionario double precision NOT NULL,
    cargo_id_cargo integer NOT NULL,
    porcentagem_comissao_funcionario double precision NOT NULL,
    CONSTRAINT ck_funcionario_salario CHECK (salario_funcionario >= 0),
    CONSTRAINT ck_funcionario_comissao CHECK (porcentagem_comissao_funcionario >= 0 AND porcentagem_comissao_funcionario <= 100),
    CONSTRAINT fk_funcionario_pessoa FOREIGN KEY (pessoa_cpf_pessoa) REFERENCES public.pessoa(cpf_pessoa) ON DELETE CASCADE,
    CONSTRAINT fk_funcionario_cargo FOREIGN KEY (cargo_id_cargo) REFERENCES public.cargo(id_cargo)
);

-- Cliente (1:1 com pessoa)
CREATE TABLE IF NOT EXISTS public.cliente (
    pessoa_cpf_pessoa character varying(20) NOT NULL PRIMARY KEY,
    renda_cliente double precision NOT NULL,
    data_cadastro_cliente date NOT NULL,
    CONSTRAINT ck_cliente_renda CHECK (renda_cliente >= 0),
    CONSTRAINT fk_cliente_pessoa FOREIGN KEY (pessoa_cpf_pessoa) REFERENCES public.pessoa(cpf_pessoa) ON DELETE CASCADE
);

-- Produto (N:1 com categoria_roupa)
CREATE SEQUENCE IF NOT EXISTS public.produto_id_produto_seq;
CREATE TABLE IF NOT EXISTS public.produto (
    id_produto integer PRIMARY KEY DEFAULT nextval('public.produto_id_produto_seq'),
    nome_produto character varying(45) NOT NULL,
    quantidade_estoque_produto integer NOT NULL DEFAULT 0,
    preco_unitario_produto double precision NOT NULL DEFAULT 0,
    id_categoria_roupa character varying(4) NOT NULL,
    tamanho character varying(10) NOT NULL,
    cor character varying(30) NOT NULL,
    CONSTRAINT ck_produto_estoque CHECK (quantidade_estoque_produto >= 0),
    CONSTRAINT ck_produto_preco CHECK (preco_unitario_produto >= 0),
    CONSTRAINT fk_produto_categoria_roupa FOREIGN KEY (id_categoria_roupa) REFERENCES public.categoria_roupa(id_categoria_roupa)
);

-- Pedido (N:1 com cliente e N:1 com funcionario)
-- Pedidos feitos pelo site usam o funcionário "online" (CPF 00000000000, cargo 0).
CREATE SEQUENCE IF NOT EXISTS public.pedido_id_pedido_seq;
CREATE TABLE IF NOT EXISTS public.pedido (
    id_pedido integer PRIMARY KEY DEFAULT nextval('public.pedido_id_pedido_seq'),
    data_pedido date NOT NULL,
    cliente_pessoa_cpf_pessoa character varying(20) NOT NULL,
    funcionario_pessoa_cpf_pessoa character varying(20) NOT NULL,
    -- entrega: CEP informado pelo cliente e valor do frete calculado pelo servidor (0 em venda presencial)
    cep_entrega character varying(8),
    valor_frete double precision NOT NULL DEFAULT 0,
    CONSTRAINT ck_pedido_frete CHECK (valor_frete >= 0),
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (cliente_pessoa_cpf_pessoa) REFERENCES public.cliente(pessoa_cpf_pessoa),
    CONSTRAINT fk_pedido_funcionario FOREIGN KEY (funcionario_pessoa_cpf_pessoa) REFERENCES public.funcionario(pessoa_cpf_pessoa)
);

-- Itens do pedido (N:N entre pedido e produto)
CREATE TABLE IF NOT EXISTS public.pedido_has_produto (
    produto_id_produto integer NOT NULL,
    pedido_id_pedido integer NOT NULL,
    quantidade integer NOT NULL,
    preco_unitario double precision NOT NULL,
    PRIMARY KEY (produto_id_produto, pedido_id_pedido),
    CONSTRAINT ck_item_quantidade CHECK (quantidade > 0),
    CONSTRAINT fk_item_produto FOREIGN KEY (produto_id_produto) REFERENCES public.produto(id_produto),
    CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id_pedido) REFERENCES public.pedido(id_pedido) ON DELETE CASCADE
);

-- Pagamento (1:1 com pedido: a chave primária é a própria FK)
CREATE TABLE IF NOT EXISTS public.pagamento (
    pedido_id_pedido integer NOT NULL PRIMARY KEY,
    data_pagamento timestamp without time zone NOT NULL,
    valor_total_pagamento double precision NOT NULL,
    CONSTRAINT fk_pagamento_pedido FOREIGN KEY (pedido_id_pedido) REFERENCES public.pedido(id_pedido) ON DELETE CASCADE
);

-- Formas usadas em cada pagamento (N:N entre pagamento e forma_pagamento)
CREATE TABLE IF NOT EXISTS public.pagamento_has_forma_pagamento (
    pagamento_id_pedido integer NOT NULL,
    forma_pagamento_id_forma_pagamento integer NOT NULL,
    valor_pago double precision NOT NULL,
    PRIMARY KEY (pagamento_id_pedido, forma_pagamento_id_forma_pagamento),
    CONSTRAINT fk_phf_pagamento FOREIGN KEY (pagamento_id_pedido) REFERENCES public.pagamento(pedido_id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_phf_forma FOREIGN KEY (forma_pagamento_id_forma_pagamento) REFERENCES public.forma_pagamento(id_forma_pagamento)
);

-- ============================================================
-- 3. AJUSTES COMPATÍVEIS COM BANCO JÁ EXISTENTE
-- ============================================================

-- Recuperação de senha por código.
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_hash character varying(64);
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_expira timestamp without time zone;
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_tentativas integer NOT NULL DEFAULT 0;

-- Bcrypt gera hashes de 60 caracteres; VARCHAR(255) oferece margem.
ALTER TABLE public.pessoa
  ALTER COLUMN senha_pessoa TYPE character varying(255);

-- CEP e valor do frete gravados no pedido.
ALTER TABLE public.pedido
  ADD COLUMN IF NOT EXISTS cep_entrega character varying(8);
ALTER TABLE public.pedido
  ADD COLUMN IF NOT EXISTS valor_frete double precision NOT NULL DEFAULT 0;

-- Garante que o frete não fique negativo em estruturas antigas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_pedido_frete'
      AND conrelid = 'public.pedido'::regclass
  ) THEN
    ALTER TABLE public.pedido
      ADD CONSTRAINT ck_pedido_frete CHECK (valor_frete >= 0);
  END IF;
END $$;

-- ============================================================
-- 4. CARGA INICIAL (tema: loja de roupas)
-- ============================================================

-- A carga de demonstração só é inserida quando pessoa está vazia.
-- Assim, ao executar em um banco já utilizado, nenhum usuário/produto/pedido
-- de demonstração é acrescentado aos dados reais existentes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pessoa) THEN
-- Pessoa (senhas guardadas como hash bcrypt. Senhas de teste: juliana e maria = admin123; os demais = 123456)
INSERT INTO public.pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa) VALUES
('00000000000', 'online', '1900-01-01', 'Loja Virtual StyleShop', '$2b$10$ysmWGNZdfAKHJN39NC5RZOE.8iLM7bTrel64RH/6gFzloFjiTimtS', 'online@styleshop.com'),
('10101010101', 'Juliana Dias', '1989-10-25', 'Rua Lins, 352', '$2b$10$RV0xsWcPu6DG8SWimawkF.uZQdkISk7tB3nMnJXPKF13VISFd2PJi', 'juliana@email.com'),
('22222222222', 'Maria Souza', '1985-02-15', 'Rua das Flores, 1234', '$2b$10$rv3U4vkvTLbehZAkmrZTNeOkjjexpkqCP4VFq3nfb2y7RWeY4WMlC', 'maria@email.com'),
('33333333333', 'Carlos Pereira', '1992-03-20', 'Rua das Palmeiras, 234', '$2b$10$UpfDM3.txvxLv2oeSeEoWOHShfxIkKH.284KZGwm2ZMCkQixD9V3K', 'carlos@email.com'),
('44444444444', 'Ana Lima', '1995-04-25', 'Alameda das Acácias, 4534 apto 13', '$2b$10$NjRQv/xXQUQee6vV9GA5EeqcMESvNLNq4u9jvuqvPiwqo6YqPjGAe', 'ana@email.com'),
('55555555555', 'Lucas Mendes', '1988-05-30', 'Rua Sexta Feira, 13 apto 666', '$2b$10$LE6/6hjR2smtfm2YHArIMeOlZ/SUl8nsehlcUZ4HsvEFezl3zu3lO', 'lucas@email.com'),
('66666666666', 'Fernanda Costa', '1993-06-05', 'Avenida Central, 243', '$2b$10$hYwszOF36FPPMfU739IM8eBcRipg/AZBbky.TCeZaAfreigGN.3vK', 'fernanda@email.com'),
('77777777777', 'Ricardo Alves', '1987-07-10', 'Rua do Comércio, 34', '$2b$10$u6zU6dS8XG9WObQVYGXD2.5jPq8SsxqDLIg9H3Ko0n4Nl9VwRzh.e', 'ricardo@email.com'),
('88888888888', 'Patrícia Gomes', '1994-08-15', 'Rua Nova, 54', '$2b$10$35x1nnedM3lt9n9WcB1.MODE8J/3CdP/2hb8XP102i6/pqtQzmCRK', 'patricia@email.com'),
('99999999999', 'Marcos Rocha', '1991-09-20', 'Rua da Praia, 100', '$2b$10$9xy8rNOcNewjPXQaqEI6Ie3KmfbVwjO9IEpUHfN3Sxf5BTt070dXu', 'marcos@email.com'),
('11111111111', 'João Silva', '1990-01-01', 'Rua do Bosque, 10', '$2b$10$VlLAXUQgac4MF/stIO/L9us75AFSih8AugGrS0gCtSbJ3zb.kbCDy', 'joao@email.com'),
('12121212121', 'Beatriz Nunes', '1996-02-11', 'Rua das Orquídeas, 88', '$2b$10$tmyh1lCdhr.7BGtWF4aOwua7YIymkZWkvUfOevY.3t7A8ZX0TGw7y', 'beatriz@email.com'),
('13131313131', 'Rafael Teixeira', '1989-11-03', 'Avenida Brasil, 1500', '$2b$10$CQt42SDfiDZvQ0Mz3PugtOqxBQG60q.IPQ9ig/kj6OHKqAvd4RM1K', 'rafael@email.com'),
('14141414141', 'Camila Ferreira', '1998-12-19', 'Rua dos Ipês, 45', '$2b$10$AatQIFjGQrazdie2G10bK.RVS73flpfmUGLoiREBr.ceyXnf2qchy', 'camila@email.com'),
('15151515151', 'Thiago Barbosa', '1994-04-07', 'Rua Paraná, 321', '$2b$10$z9SfPeiDrQeJmtNfuaS8aO2Q8JFvfUmd6qhyIcVuZaecWPVrej1e2', 'thiago@email.com'),
('16161616161', 'Larissa Martins', '2000-06-30', 'Travessa do Sol, 12', '$2b$10$f9Kzpb02mcwS7GIxgZnK1e2KehGXNDZB.TYt7IlfrlZ00bYGEo6m2', 'larissa@email.com'),
('17171717171', 'Bruno Carvalho', '1997-09-09', 'Rua Santos Dumont, 765', '$2b$10$wPfxJCdeQKXmDnsBwfk/M.9tIUtyyfctnu3cHUvKMTQnBTJjiHGPu', 'bruno@email.com')
ON CONFLICT DO NOTHING;

-- Cargo
INSERT INTO public.cargo (id_cargo, nome_cargo) VALUES
(0, 'Vendedor online'),
(1, 'Vendedor'),
(2, 'Gerente'),
(3, 'Caixa'),
(4, 'Supervisor'),
(5, 'Atendente'),
(6, 'Repositor'),
(7, 'Conferente'),
(8, 'Assistente'),
(9, 'Auxiliar'),
(10, 'Diretor')
ON CONFLICT DO NOTHING;

-- Categoria de roupa
INSERT INTO public.categoria_roupa (id_categoria_roupa, nome_categoria_roupa) VALUES
('FEM', 'Feminino'),
('MASC', 'Masculino'),
('VER', 'Verão'),
('INV', 'Inverno'),
('INF', 'Infantil'),
('UNI', 'Unissex'),
('ESP', 'Esportivo'),
('ACE', 'Acessórios'),
('PRAI', 'Praia'),
('SOC', 'Social')
ON CONFLICT DO NOTHING;

-- Funcionario (administradores/funcionários da loja)
INSERT INTO public.funcionario (pessoa_cpf_pessoa, salario_funcionario, cargo_id_cargo, porcentagem_comissao_funcionario) VALUES
('00000000000', 0, 0, 0),
('10101010101', 5000, 2, 15),
('22222222222', 8000, 10, 20),
('33333333333', 1500, 3, 3),
('44444444444', 2000, 1, 8),
('55555555555', 2500, 4, 6),
('66666666666', 1800, 5, 4),
('77777777777', 1600, 6, 2),
('88888888888', 1900, 7, 3),
('99999999999', 1700, 8, 3)
ON CONFLICT DO NOTHING;

-- Cliente
INSERT INTO public.cliente (pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente) VALUES
('66666666666', 3500, '2025-11-06'),
('77777777777', 2700, '2025-11-07'),
('88888888888', 5000, '2025-11-08'),
('99999999999', 3800, '2025-11-09'),
('11111111111', 2500, '2025-11-10'),
('12121212121', 3100, '2025-11-12'),
('13131313131', 4200, '2025-11-15'),
('14141414141', 2900, '2025-11-20'),
('15151515151', 3300, '2025-12-02'),
('16161616161', 1900, '2025-12-10'),
('17171717171', 2600, '2025-12-15')
ON CONFLICT DO NOTHING;

-- Produto (ids 2 a 10 e 50 têm imagem; os demais usam a silhueta padrão)
INSERT INTO public.produto (id_produto, nome_produto, quantidade_estoque_produto, preco_unitario_produto, id_categoria_roupa, tamanho, cor) VALUES
(2, 'Camiseta Estampada', 200, 43, 'VER', 'P', 'Branco'),
(3, 'Vestido Floral', 150, 89.9, 'FEM', 'M', 'Vermelho'),
(4, 'Blusa Casual', 80, 32, 'FEM', 'P', 'Branco'),
(5, 'Jaqueta Jeans', 50, 70, 'INV', 'G', 'Azul'),
(6, 'Blusa de Frio', 60, 45, 'INV', 'G', 'Cinza'),
(7, 'Shorts Esportivo', 300, 75, 'VER', 'M', 'Preto'),
(8, 'Camiseta Básica', 40, 60, 'MASC', 'M', 'Preto'),
(9, 'Calça Jeans', 30, 85, 'MASC', '42', 'Azul'),
(10, 'Vestido Casual', 20, 79.9, 'FEM', 'P', 'Verde'),
(11, 'Camisa Social Slim', 45, 119.9, 'SOC', 'M', 'Branco'),
(12, 'Biquíni Listrado', 35, 69.9, 'PRAI', 'M', 'Azul'),
(13, 'Conjunto Moletom Infantil', 60, 99.9, 'INF', '6', 'Rosa'),
(14, 'Legging Fitness', 90, 59.9, 'ESP', 'M', 'Preto'),
(15, 'Cinto de Couro', 70, 49.9, 'ACE', 'Único', 'Marrom'),
(16, 'Moletom Unissex', 80, 129.9, 'UNI', 'G', 'Cinza'),
(50, 'Boné', 50, 50, 'VER', 'Único', 'Preto')
ON CONFLICT DO NOTHING;

-- Forma de pagamento
INSERT INTO public.forma_pagamento (id_forma_pagamento, nome_forma_pagamento) VALUES
(1, 'Dinheiro'),
(2, 'Cartão de Crédito'),
(3, 'Cartão de Débito'),
(4, 'Pix'),
(5, 'Boleto'),
(6, 'Transferência Bancária'),
(7, 'Crédito Loja'),
(8, 'Gift Card'),
(9, 'Vale Troca'),
(10, 'Carteira Digital')
ON CONFLICT DO NOTHING;

-- Pedido (o pedido 12 está aguardando pagamento)
INSERT INTO public.pedido (id_pedido, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa) VALUES
(1, '2026-01-15', '66666666666', '44444444444'),
(2, '2026-02-03', '11111111111', '00000000000'),
(3, '2026-02-20', '12121212121', '00000000000'),
(4, '2026-03-08', '77777777777', '22222222222'),
(5, '2026-03-25', '13131313131', '44444444444'),
(6, '2026-04-12', '88888888888', '00000000000'),
(7, '2026-05-05', '14141414141', '33333333333'),
(8, '2026-06-18', '99999999999', '00000000000'),
(9, '2026-07-02', '15151515151', '44444444444'),
(10, '2026-08-14', '16161616161', '00000000000'),
(11, '2026-09-09', '11111111111', '00000000000'),
(12, '2026-10-21', '17171717171', '00000000000')
ON CONFLICT DO NOTHING;

-- Itens do pedido
INSERT INTO public.pedido_has_produto (produto_id_produto, pedido_id_pedido, quantidade, preco_unitario) VALUES
(3, 1, 1, 89.9),
(2, 1, 2, 43),
(5, 2, 1, 70),
(11, 3, 1, 119.9),
(15, 3, 1, 49.9),
(9, 4, 1, 85),
(8, 4, 2, 60),
(12, 5, 1, 69.9),
(50, 5, 1, 50),
(10, 6, 2, 79.9),
(13, 7, 1, 99.9),
(6, 7, 1, 45),
(14, 8, 2, 59.9),
(7, 8, 1, 75),
(16, 9, 1, 129.9),
(4, 9, 3, 32),
(2, 10, 3, 43),
(3, 11, 1, 89.9),
(15, 11, 1, 49.9),
(50, 11, 1, 50),
(9, 12, 1, 85),
(16, 12, 1, 129.9)
ON CONFLICT DO NOTHING;

-- Pagamento
INSERT INTO public.pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento) VALUES
(1, '2026-01-15 10:15:00', 175.9),
(2, '2026-02-03 20:40:00', 70),
(3, '2026-02-20 21:05:00', 169.8),
(4, '2026-03-08 14:30:00', 205),
(5, '2026-03-25 16:10:00', 119.9),
(6, '2026-04-12 22:15:00', 159.8),
(7, '2026-05-05 11:20:00', 144.9),
(8, '2026-06-18 19:50:00', 194.8),
(9, '2026-07-02 15:45:00', 225.9),
(10, '2026-08-14 08:55:00', 129),
(11, '2026-09-09 18:30:00', 189.8)
ON CONFLICT DO NOTHING;

-- Formas usadas em cada pagamento
INSERT INTO public.pagamento_has_forma_pagamento (pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago) VALUES
(1, 4, 175.9),
(2, 2, 70),
(3, 4, 169.8),
(4, 2, 100),
(4, 1, 105),
(5, 3, 119.9),
(6, 4, 159.8),
(7, 5, 144.9),
(8, 2, 194.8),
(9, 8, 100),
(9, 4, 125.9),
(10, 10, 129),
(11, 2, 189.8)
ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 5. SEQUENCES (para novos INSERTs sem informar o id)
-- ============================================================
SELECT setval('public.cargo_id_cargo_seq', GREATEST(COALESCE((SELECT MAX(id_cargo) FROM public.cargo), 1), 1), EXISTS (SELECT 1 FROM public.cargo));
SELECT setval('public.produto_id_produto_seq', GREATEST(COALESCE((SELECT MAX(id_produto) FROM public.produto), 1), 1), EXISTS (SELECT 1 FROM public.produto));
SELECT setval('public.pedido_id_pedido_seq', GREATEST(COALESCE((SELECT MAX(id_pedido) FROM public.pedido), 1), 1), EXISTS (SELECT 1 FROM public.pedido));
SELECT setval('public.forma_pagamento_id_forma_pagamento_seq', GREATEST(COALESCE((SELECT MAX(id_forma_pagamento) FROM public.forma_pagamento), 1), 1), EXISTS (SELECT 1 FROM public.forma_pagamento));


COMMIT;
