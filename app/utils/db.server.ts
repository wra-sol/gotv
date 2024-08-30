import { Pool, PoolClient } from 'pg';
import {
  initializeDatabase as initDB,
  checkInitialized as checkInit,
  query as dbQuery,
  getClient as getDbClient,
  closePool as closeDbPool,
  pool as dbPool
} from "../../dbServer";

let pool: Pool | null = null;

export const initializeDatabase = async (config: any) => {
  if (!pool) {
    await initDB(config);
    pool = dbPool;
  }
};

export const checkInitialized = async (): Promise<boolean> => {
  if (!pool) return false;
  return checkInit();
};

export const query = dbQuery;
export const getClient = getDbClient;
export const closePool = closeDbPool;

export const ensureConnection = async (): Promise<PoolClient> => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return await pool.connect();
};