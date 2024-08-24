import { Pool, PoolConfig, QueryResult } from 'pg';

let pool: Pool | null = null;

export interface DbConfig extends PoolConfig {
  // You can add any additional configuration options here
}

export const initDbConnection = async (config: DbConfig): Promise<void> => {
  console.log('Initializing database connection...');
  try {
    pool = new Pool(config);
    
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Error initializing database connection:', error);
    throw error;
  }
};

export const getDbPool = (): Pool => {
  if (!pool) {
    throw new Error('Database connection not initialized. Call initDbConnection first.');
  }
  return pool;
};

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const pool = getDbPool();
  return pool.query(text, params);
};

export const closeDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection closed.');
  }
};