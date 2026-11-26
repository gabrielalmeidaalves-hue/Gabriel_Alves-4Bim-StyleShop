-- Para quem JÁ criou o banco com uma versão anterior do styleshop.sql:
-- acrescenta as colunas usadas na recuperação de senha por código (não apaga dados).
ALTER TABLE public.pessoa ADD COLUMN IF NOT EXISTS token_recuperacao_hash character varying(64);
ALTER TABLE public.pessoa ADD COLUMN IF NOT EXISTS token_recuperacao_expira timestamp without time zone;
ALTER TABLE public.pessoa ADD COLUMN IF NOT EXISTS token_recuperacao_tentativas integer NOT NULL DEFAULT 0;
