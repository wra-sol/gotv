import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
let db: any;

async function initializeSqlite() {
  if (typeof window !== 'undefined') {
    throw new Error('Database operations are not allowed on the client side');
  }

  if (!db) {
    db = await open({
      filename: "./database.sqlite",
      driver: sqlite3.Database,
    });
    await db.run('PRAGMA journal_mode = WAL;');
    await db.run('PRAGMA synchronous = NORMAL;');
    await db.run('PRAGMA busy_timeout = 5000');
    await db.run('PRAGMA temp_store = MEMORY');
    await setupChangeTracking();
  }
  return db;
}

async function setupChangeTracking() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS contacts_after_insert 
    AFTER INSERT ON contacts
    BEGIN
      INSERT INTO changes (table_name, record_id, action)
      VALUES ('contacts', NEW.id, 'INSERT');
    END
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS contacts_after_update 
    AFTER UPDATE ON contacts
    BEGIN
      INSERT INTO changes (table_name, record_id, action)
      VALUES ('contacts', NEW.id, 'UPDATE');
    END
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS contacts_after_delete 
    AFTER DELETE ON contacts
    BEGIN
      INSERT INTO changes (table_name, record_id, action)
      VALUES ('contacts', OLD.id, 'DELETE');
    END
  `);
}

export async function getDb() {
  if (!db) {
    await initializeSqlite();
  }
  return db;
}

export async function checkInitialized() {
  const db = await getDb();
  const result = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  return !!result;
}

export async function initializeDatabase({
  ownerUsername,
  ownerPassword,
  dbType,
  pgConfig,
}: {
  ownerUsername: string;
  ownerPassword: string;
  dbType: string;
  pgConfig?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}) {
  if (dbType === "sqlite") {
    const db = await getDb();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_owner BOOLEAN NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstname TEXT,
        surname TEXT,
        email TEXT,
        unit TEXT,
        street_name TEXT,
        street_number TEXT,
        address TEXT,
        city TEXT,
        postal TEXT,
        phone TEXT,
        external_id TEXT,
        electoral_district TEXT,
        poll_id TEXT,
        voted BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );

      CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
      AFTER UPDATE ON users
      FOR EACH ROW
      BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp 
      AFTER UPDATE ON contacts
      FOR EACH ROW
      BEGIN
        UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    const result = await db.run(
      "INSERT INTO users (username, password, is_owner, created_by, updated_by) VALUES (?, ?, ?, ?, ?)",
      [ownerUsername, ownerPassword, true, null, null]
    );

    const ownerId = result.lastID;

    await db.run(
      "UPDATE users SET created_by = ?, updated_by = ? WHERE id = ?",
      [ownerId, ownerId, ownerId]
    );

    await db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
      ["database_type", "sqlite"]
    );
  } else if (dbType === "postgres" && pgConfig) {
    const client = new pg.Client(pgConfig);
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_owner BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        firstname TEXT,
        surname TEXT,
        email TEXT,
        unit TEXT,
        street_name TEXT,
        street_number TEXT,
        address TEXT,
        city TEXT,
        postal TEXT,
        phone TEXT,
        external_id TEXT,
        electoral_district TEXT,
        poll_id TEXT,
        voted BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      );

      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_users_timestamp ON users;
      CREATE TRIGGER update_users_timestamp
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();

      DROP TRIGGER IF EXISTS update_contacts_timestamp ON contacts;
      CREATE TRIGGER update_contacts_timestamp
      BEFORE UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
    `);

    const result = await client.query(
      "INSERT INTO users (username, password, is_owner, created_by, updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [ownerUsername, ownerPassword, true, null, null]
    );

    const ownerId = result.rows[0].id;

    await client.query(
      "UPDATE users SET created_by = $1, updated_by = $1 WHERE id = $1",
      [ownerId]
    );

    await client.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2)",
      ["database_type", "postgres"]
    );

    await client.end();
  } else {
    throw new Error("Invalid database type or configuration");
  }
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

export async function shutdownDb() {
  if (db) {
    await db.run('PRAGMA journal_mode = DELETE');
    await closeDb();
  }
}

export { db };