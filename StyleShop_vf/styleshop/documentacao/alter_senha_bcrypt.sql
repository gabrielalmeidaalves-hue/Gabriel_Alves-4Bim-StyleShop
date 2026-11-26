-- Para quem JÁ criou o banco antes do bcrypt:
-- o hash bcrypt tem 60 caracteres, então a coluna precisa ser maior que os 50 antigos.
-- Não apaga nada. Depois disto, as senhas em texto puro são migradas de duas formas:
--   1) automaticamente, no primeiro login correto de cada pessoa; ou
--   2) de uma vez, rodando no terminal:  npm run migrar-senhas   (esse script também faz este ALTER)
ALTER TABLE public.pessoa ALTER COLUMN senha_pessoa TYPE character varying(255);
