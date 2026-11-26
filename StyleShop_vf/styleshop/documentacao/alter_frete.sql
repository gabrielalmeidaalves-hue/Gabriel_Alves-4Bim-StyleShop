-- Para quem JÁ criou o banco com uma versão anterior do styleshop.sql:
-- acrescenta as colunas do frete na tabela pedido (não apaga dados; pedidos antigos ficam com frete 0).
ALTER TABLE public.pedido ADD COLUMN IF NOT EXISTS cep_entrega character varying(8);
ALTER TABLE public.pedido ADD COLUMN IF NOT EXISTS valor_frete double precision NOT NULL DEFAULT 0;
