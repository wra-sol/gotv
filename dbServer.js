import pkg from "pg";
const { Pool } = pkg;

let pool;

export async function initializeDatabase(config) {
  try {
    if (!config || !config.user || !config.host || !config.database || !config.password || !config.port) {
      throw new Error("Invalid database configuration");
    }

    pool = new Pool(config);

    const client = await pool.connect();
    console.log("Successfully connected to the database");
    client.release();

    if (!(await checkInitialized())) {
      await createTables();
      await createConstraints();
      await createFunctions();
      await createTriggers();
      await createViews();
      await createIndexes();
      console.log("Database initialized successfully");
    } else {
      console.log("Database already initialized");
    }
  } catch (err) {
    console.error("Failed to initialize the database", err);
    throw err;
  }
}

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_owner BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        external_id TEXT UNIQUE,
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
        electoral_district TEXT,
        poll_id TEXT,
        voted BOOLEAN,
        ride_status TEXT,
        last_contacted TEXT,
        last_contacted_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        interaction_type TEXT NOT NULL,
        support_level TEXT,
        wants_sign BOOLEAN,
        will_volunteer BOOLEAN,
        plan_to_vote TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER
      );
    `);
    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function createConstraints() {
  const client = await pool.connect();
  try {
    // Check if each constraint exists before adding it
    const constraintsToCheck = [
      { constraint: 'fk_users_created_by', table: 'users' },
      { constraint: 'fk_users_updated_by', table: 'users' },
      { constraint: 'fk_contacts_created_by', table: 'contacts' },
      { constraint: 'fk_contacts_updated_by', table: 'contacts' },
      { constraint: 'fk_interactions_contact_id', table: 'interactions' },
      { constraint: 'fk_interactions_created_by', table: 'interactions' }
    ];

    for (const { constraint, table } of constraintsToCheck) {
      const res = await client.query(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = $1 AND constraint_name = $2`,
        [table, constraint]
      );

      if (res.rows.length === 0) {
        try {
          const foreignTable = constraint.includes('contacts') ? 'contacts' : 'users';
          const foreignColumn = 'id';
          await client.query(
            `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${constraint.split('_')[2]}) REFERENCES ${foreignTable}(${foreignColumn});`
          );
        } catch (e) {
          console.error(e)
        }
      }
    }


    console.log("Constraints created successfully");
  } catch (err) {
    console.error("Error creating constraints:", err);
    throw err;
  } finally {
    client.release();
  }
}


async function createFunctions() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION notify_interaction_change() RETURNS TRIGGER AS $$
      DECLARE
        payload json;
      BEGIN
        payload = json_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'interaction_type', NEW.interaction_type,
          'support_level', NEW.support_level,
          'wants_sign', NEW.wants_sign,
          'will_volunteer', NEW.will_volunteer,
          'plan_to_vote', NEW.plan_to_vote,
          'notes', NEW.notes,
          'created_at', NEW.created_at
        );
        PERFORM pg_notify('interaction_changes', payload::text);
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION notify_contact_change() RETURNS TRIGGER AS $$
      DECLARE
        payload json;
      BEGIN
        payload = json_build_object(
          'id', NEW.id,
          'external_id', NEW.external_id,
          'firstname', NEW.firstname,
          'surname', NEW.surname,
          'email', NEW.email,
          'unit', NEW.unit,
          'street_name', NEW.street_name,
          'street_number', NEW.street_number,
          'address', NEW.address,
          'city', NEW.city,
          'postal', NEW.postal,
          'phone', NEW.phone,
          'electoral_district', NEW.electoral_district,
          'poll_id', NEW.poll_id,
          'voted', NEW.voted,
          'ride_status', NEW.ride_status,
          'last_contacted', NEW.last_contacted,
          'last_contacted_by', NEW.last_contacted_by,
          'created_at', NEW.created_at,
          'created_by', NEW.created_by,
          'updated_at', NEW.updated_at,
          'updated_by', NEW.updated_by
        );
        PERFORM pg_notify('contact_changes', payload::text);
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("Functions created successfully");
  } catch (err) {
    console.error("Error creating functions:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function createTriggers() {
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_timestamp ON users;
      DROP TRIGGER IF EXISTS update_contacts_timestamp ON contacts;
      DROP TRIGGER IF EXISTS interaction_change_trigger ON interactions;

      CREATE TRIGGER update_users_timestamp
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();

      CREATE TRIGGER update_contacts_timestamp
      BEFORE UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();

      CREATE TRIGGER interaction_change_trigger
      AFTER INSERT OR UPDATE ON interactions
      FOR EACH ROW
      EXECUTE FUNCTION notify_interaction_change();
      
      CREATE TRIGGER contact_change_trigger
      AFTER INSERT OR UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION notify_contact_change();
    `);
    console.log("Triggers created successfully");
  } catch (err) {
    console.error("Error creating triggers:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function createViews() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE OR REPLACE VIEW current_contact_state AS
      SELECT 
        c.*,
        i.support_level,
        i.wants_sign,
        i.will_volunteer,
        i.plan_to_vote,
        i.notes,
        i.created_at AS last_interaction_date
      FROM 
        contacts c
      LEFT JOIN LATERAL (
        SELECT *
        FROM interactions
        WHERE contact_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) i ON true;
    `);
    console.log("Views created successfully");
  } catch (err) {
    console.error("Error creating views:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function createIndexes() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_contact_id_created_at 
      ON interactions(contact_id, created_at DESC);
    `);
    console.log("Indexes created successfully");
  } catch (err) {
    console.error("Error creating indexes:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function getClient() {
  if (!pool) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return await pool.connect();
}

export async function query(text, params) {
  if (!pool) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function checkInitialized() {
  try {
    const result = await query("SELECT to_regclass('public.users') as exists");
    return !!result.rows[0].exists;
  } catch (error) {
    console.error("Error checking if 'users' table exists in database initialization check:", error);
    return false;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
  }
}
