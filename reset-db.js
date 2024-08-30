import { pool, initializeDatabaseStructure} from "./dbServer.js"

async function resetDatabase() {
  const client = await pool?.connect();
  try {
    await client?.query('DROP SCHEMA public CASCADE');
    await client?.query('CREATE SCHEMA public');
    await initializeDatabaseStructure();
    console.log('Database reset and reinitialized successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    client?.release();
    await pool?.end();
  }
}

resetDatabase();