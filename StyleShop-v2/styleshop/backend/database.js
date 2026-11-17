// Conexão com o PostgreSQL - os dados vêm do arquivo .env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  max: 10
};

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões:', err);
  process.exit(-1);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log('Conectado ao PostgreSQL com sucesso!');
    return true;
  } catch (err) {
    console.error('Erro ao conectar com o PostgreSQL:', err.message);
    return false;
  }
};

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public');
    return await client.query(text, params);
  } catch (error) {
    console.error('Erro ao executar query:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO public');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na transação:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction, testConnection };
