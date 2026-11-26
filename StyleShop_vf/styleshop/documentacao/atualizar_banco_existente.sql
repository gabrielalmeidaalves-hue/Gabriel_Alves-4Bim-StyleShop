-- StyleShop: atualização segura de um banco JÁ EXISTENTE.
-- Este script NÃO apaga tabelas, usuários, produtos, pedidos ou relacionamentos.
-- Execute conectado ao banco styleshop. Faça backup antes de qualquer alteração.

BEGIN;

-- Campos usados pela recuperação de senha por código.
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_hash character varying(64);
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_expira timestamp without time zone;
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS token_recuperacao_tentativas integer NOT NULL DEFAULT 0;

-- O hash bcrypt tem 60 caracteres; 255 também permite futuras mudanças.
ALTER TABLE public.pessoa
  ALTER COLUMN senha_pessoa TYPE character varying(255);

-- Campos usados para registrar CEP e frete no pedido.
ALTER TABLE public.pedido
  ADD COLUMN IF NOT EXISTS cep_entrega character varying(8);
ALTER TABLE public.pedido
  ADD COLUMN IF NOT EXISTS valor_frete double precision NOT NULL DEFAULT 0;

COMMIT;
