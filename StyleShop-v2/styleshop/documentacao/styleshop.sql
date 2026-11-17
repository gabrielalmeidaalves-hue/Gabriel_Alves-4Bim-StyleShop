-- ============================================================
-- StyleShop - Loja de Roupas
-- Projeto DW1 - 4º bimestre 2026
-- Aluno: Gabriel de Almeida Alves | Turma: M32 | 2026
-- Owner: gabriel
--
-- Antes de rodar este script, crie o banco (uma vez):
--   CREATE DATABASE styleshop OWNER gabriel;
-- e conecte-se nele. O script pode ser executado várias vezes
-- (ele apaga e recria as tabelas).
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
-- 1. LIMPEZA
-- ============================================================
DROP TABLE IF EXISTS public.pagamento_has_forma_pagamento CASCADE;
DROP TABLE IF EXISTS public.pedido_has_produto CASCADE;
DROP TABLE IF EXISTS public.pagamento CASCADE;
DROP TABLE IF EXISTS public.pedido CASCADE;
DROP TABLE IF EXISTS public.produto CASCADE;
DROP TABLE IF EXISTS public.categoria_roupa CASCADE;
DROP TABLE IF EXISTS public.forma_pagamento CASCADE;
DROP TABLE IF EXISTS public.funcionario CASCADE;
DROP TABLE IF EXISTS public.cliente CASCADE;
DROP TABLE IF EXISTS public.cargo CASCADE;
DROP TABLE IF EXISTS public.pessoa CASCADE;

DROP SEQUENCE IF EXISTS public.cargo_id_cargo_seq;
DROP SEQUENCE IF EXISTS public.forma_pagamento_id_forma_pagamento_seq;
DROP SEQUENCE IF EXISTS public.pedido_id_pedido_seq;
DROP SEQUENCE IF EXISTS public.produto_id_produto_seq;

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- Pessoa (independente)
CREATE TABLE public.pessoa (
    cpf_pessoa character varying(20) NOT NULL PRIMARY KEY,
    nome_pessoa character varying(60) NOT NULL,
    data_nascimento_pessoa date NOT NULL,
    endereco_pessoa character varying(150) NOT NULL,
    senha_pessoa character varying(50) NOT NULL,
    email_pessoa character varying(75) NOT NULL,
    -- recuperação de senha: hash SHA-256 do código de 6 números enviado por e-mail, validade e nº de tentativas erradas
    token_recuperacao_hash character varying(64),
    token_recuperacao_expira timestamp without time zone,
    token_recuperacao_tentativas integer NOT NULL DEFAULT 0,
    CONSTRAINT pessoa_unique UNIQUE (email_pessoa)
);

-- Cargo (independente)
CREATE SEQUENCE public.cargo_id_cargo_seq;
CREATE TABLE public.cargo (
    id_cargo integer PRIMARY KEY DEFAULT nextval('public.cargo_id_cargo_seq'),
    nome_cargo character varying(45) NOT NULL
);
ALTER SEQUENCE public.cargo_id_cargo_seq OWNED BY public.cargo.id_cargo;

-- Categoria de roupa (independente) - o id é uma sigla de até 4 letras
CREATE TABLE public.categoria_roupa (
    id_categoria_roupa character varying(4) NOT NULL PRIMARY KEY,
    nome_categoria_roupa character varying(50) NOT NULL
);

-- Forma de pagamento (independente)
CREATE SEQUENCE public.forma_pagamento_id_forma_pagamento_seq;
CREATE TABLE public.forma_pagamento (
    id_forma_pagamento integer PRIMARY KEY DEFAULT nextval('public.forma_pagamento_id_forma_pagamento_seq'),
    nome_forma_pagamento character varying(100) NOT NULL
);
ALTER SEQUENCE public.forma_pagamento_id_forma_pagamento_seq OWNED BY public.forma_pagamento.id_forma_pagamento;

-- Funcionario (1:1 com pessoa, N:1 com cargo)
CREATE TABLE public.funcionario (
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
CREATE TABLE public.cliente (
    pessoa_cpf_pessoa character varying(20) NOT NULL PRIMARY KEY,
    renda_cliente double precision NOT NULL,
    data_cadastro_cliente date NOT NULL,
    CONSTRAINT ck_cliente_renda CHECK (renda_cliente >= 0),
    CONSTRAINT fk_cliente_pessoa FOREIGN KEY (pessoa_cpf_pessoa) REFERENCES public.pessoa(cpf_pessoa) ON DELETE CASCADE
);

-- Produto (N:1 com categoria_roupa)
CREATE SEQUENCE public.produto_id_produto_seq;
CREATE TABLE public.produto (
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
ALTER SEQUENCE public.produto_id_produto_seq OWNED BY public.produto.id_produto;

-- Pedido (N:1 com cliente e N:1 com funcionario)
-- Pedidos feitos pelo site usam o funcionário "online" (CPF 00000000000, cargo 0).
CREATE SEQUENCE public.pedido_id_pedido_seq;
CREATE TABLE public.pedido (
    id_pedido integer PRIMARY KEY DEFAULT nextval('public.pedido_id_pedido_seq'),
    data_pedido date NOT NULL,
    cliente_pessoa_cpf_pessoa character varying(20) NOT NULL,
    funcionario_pessoa_cpf_pessoa character varying(20) NOT NULL,
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (cliente_pessoa_cpf_pessoa) REFERENCES public.cliente(pessoa_cpf_pessoa),
    CONSTRAINT fk_pedido_funcionario FOREIGN KEY (funcionario_pessoa_cpf_pessoa) REFERENCES public.funcionario(pessoa_cpf_pessoa)
);
ALTER SEQUENCE public.pedido_id_pedido_seq OWNED BY public.pedido.id_pedido;

-- Itens do pedido (N:N entre pedido e produto)
CREATE TABLE public.pedido_has_produto (
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
CREATE TABLE public.pagamento (
    pedido_id_pedido integer NOT NULL PRIMARY KEY,
    data_pagamento timestamp without time zone NOT NULL,
    valor_total_pagamento double precision NOT NULL,
    CONSTRAINT fk_pagamento_pedido FOREIGN KEY (pedido_id_pedido) REFERENCES public.pedido(id_pedido) ON DELETE CASCADE
);

-- Formas usadas em cada pagamento (N:N entre pagamento e forma_pagamento)
CREATE TABLE public.pagamento_has_forma_pagamento (
    pagamento_id_pedido integer NOT NULL,
    forma_pagamento_id_forma_pagamento integer NOT NULL,
    valor_pago double precision NOT NULL,
    PRIMARY KEY (pagamento_id_pedido, forma_pagamento_id_forma_pagamento),
    CONSTRAINT fk_phf_pagamento FOREIGN KEY (pagamento_id_pedido) REFERENCES public.pagamento(pedido_id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_phf_forma FOREIGN KEY (forma_pagamento_id_forma_pagamento) REFERENCES public.forma_pagamento(id_forma_pagamento)
);

-- ============================================================
-- 3. OWNER = gabriel
-- ============================================================
ALTER TABLE public.pessoa OWNER TO gabriel;
ALTER TABLE public.cargo OWNER TO gabriel;
ALTER TABLE public.categoria_roupa OWNER TO gabriel;
ALTER TABLE public.funcionario OWNER TO gabriel;
ALTER TABLE public.cliente OWNER TO gabriel;
ALTER TABLE public.produto OWNER TO gabriel;
ALTER TABLE public.pedido OWNER TO gabriel;
ALTER TABLE public.pedido_has_produto OWNER TO gabriel;
ALTER TABLE public.forma_pagamento OWNER TO gabriel;
ALTER TABLE public.pagamento OWNER TO gabriel;
ALTER TABLE public.pagamento_has_forma_pagamento OWNER TO gabriel;
-- As sequences são vinculadas (OWNED BY) às colunas; o PostgreSQL já passa o owner delas para gabriel junto com a tabela.

-- ============================================================
-- 4. CARGA INICIAL (tema: loja de roupas)
-- ============================================================

-- Pessoa
INSERT INTO public.pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa) VALUES
('00000000000', 'online', '1900-01-01', 'Loja Virtual StyleShop', 'abc123', 'online@styleshop.com'),
('10101010101', 'Juliana Dias', '1989-10-25', 'Rua Lins, 352', 'admin123', 'juliana@email.com'),
('22222222222', 'Maria Souza', '1985-02-15', 'Rua das Flores, 1234', 'admin123', 'maria@email.com'),
('33333333333', 'Carlos Pereira', '1992-03-20', 'Rua das Palmeiras, 234', '123456', 'carlos@email.com'),
('44444444444', 'Ana Lima', '1995-04-25', 'Alameda das Acácias, 4534 apto 13', '123456', 'ana@email.com'),
('55555555555', 'Lucas Mendes', '1988-05-30', 'Rua Sexta Feira, 13 apto 666', '123456', 'lucas@email.com'),
('66666666666', 'Fernanda Costa', '1993-06-05', 'Avenida Central, 243', '123456', 'fernanda@email.com'),
('77777777777', 'Ricardo Alves', '1987-07-10', 'Rua do Comércio, 34', '123456', 'ricardo@email.com'),
('88888888888', 'Patrícia Gomes', '1994-08-15', 'Rua Nova, 54', '123456', 'patricia@email.com'),
('99999999999', 'Marcos Rocha', '1991-09-20', 'Rua da Praia, 100', '123456', 'marcos@email.com'),
('11111111111', 'João Silva', '1990-01-01', 'Rua do Bosque, 10', '123456', 'joao@email.com'),
('12121212121', 'Beatriz Nunes', '1996-02-11', 'Rua das Orquídeas, 88', '123456', 'beatriz@email.com'),
('13131313131', 'Rafael Teixeira', '1989-11-03', 'Avenida Brasil, 1500', '123456', 'rafael@email.com'),
('14141414141', 'Camila Ferreira', '1998-12-19', 'Rua dos Ipês, 45', '123456', 'camila@email.com'),
('15151515151', 'Thiago Barbosa', '1994-04-07', 'Rua Paraná, 321', '123456', 'thiago@email.com'),
('16161616161', 'Larissa Martins', '2000-06-30', 'Travessa do Sol, 12', '123456', 'larissa@email.com'),
('17171717171', 'Bruno Carvalho', '1997-09-09', 'Rua Santos Dumont, 765', '123456', 'bruno@email.com');

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
(10, 'Diretor');

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
('SOC', 'Social');

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
('99999999999', 1700, 8, 3);

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
('17171717171', 2600, '2025-12-15');

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
(50, 'Boné', 50, 50, 'VER', 'Único', 'Preto');

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
(10, 'Carteira Digital');

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
(12, '2026-10-21', '17171717171', '00000000000');

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
(16, 12, 1, 129.9);

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
(11, '2026-09-09 18:30:00', 189.8);

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
(11, 2, 189.8);

-- ============================================================
-- 5. SEQUENCES (para novos INSERTs sem informar o id)
-- ============================================================
SELECT pg_catalog.setval('public.cargo_id_cargo_seq', 10, true);
SELECT pg_catalog.setval('public.produto_id_produto_seq', 50, true);
SELECT pg_catalog.setval('public.pedido_id_pedido_seq', 12, true);
SELECT pg_catalog.setval('public.forma_pagamento_id_forma_pagamento_seq', 10, true);
