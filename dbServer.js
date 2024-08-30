import pkg from "pg";
const { Pool } = pkg;

let pool;

async function initializeDatabase(config) {
  try {
    pool = new Pool(config);

    const client = await pool.connect();
    console.log("Successfully connected to the database");
    client.release();
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

      CREATE TABLE IF NOT EXISTS custom_fields (
        id SERIAL PRIMARY KEY,
        section TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        options TEXT,
        is_default BOOLEAN,
        UNIQUE(section, field_name)
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

      CREATE TABLE IF NOT EXISTS contact_field_values (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        field_id INTEGER NOT NULL,
        value TEXT,
        FOREIGN KEY (contact_id) REFERENCES contacts(id),
        FOREIGN KEY (field_id) REFERENCES custom_fields(id),
        UNIQUE (contact_id, field_id)
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        interaction_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        updated_at TIMESTAMP WITH TIME ZONE 
      );

      CREATE TABLE IF NOT EXISTS interaction_field_values (
        id SERIAL PRIMARY KEY,
        interaction_id INTEGER NOT NULL,
        field_id INTEGER NOT NULL,
        value TEXT,
        FOREIGN KEY (interaction_id) REFERENCES interactions(id),
        FOREIGN KEY (field_id) REFERENCES custom_fields(id),
        UNIQUE (interaction_id, field_id)
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
    await client.query('BEGIN');

    const constraints = [
      {
        table: 'contacts',
        name: 'fk_contacts_created_by',
        definition: 'FOREIGN KEY (created_by) REFERENCES users(id)'
      },
      {
        table: 'contacts',
        name: 'fk_contacts_updated_by',
        definition: 'FOREIGN KEY (updated_by) REFERENCES users(id)'
      },
      {
        table: 'interactions',
        name: 'fk_interactions_contact_id',
        definition: 'FOREIGN KEY (contact_id) REFERENCES contacts(id)'
      },
      {
        table: 'interactions',
        name: 'fk_interactions_created_by',
        definition: 'FOREIGN KEY (created_by) REFERENCES users(id)'
      },
      {
        table: 'users',
        name: 'fk_users_created_by',
        definition: 'FOREIGN KEY (created_by) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED'
      },
      {
        table: 'users',
        name: 'fk_users_updated_by',
        definition: 'FOREIGN KEY (updated_by) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED'
      }
    ];

    for (let i = 0; i < constraints.length; i++) {
      const { table, name, definition } = constraints[i];
      try {
        // Check if constraint exists
        const checkResult = await client.query(`
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_name = $1 AND constraint_name = $2
        `, [table, name]);

        if (checkResult.rows.length === 0) {
          // Constraint doesn't exist, so add it
          await client.query(`
            ALTER TABLE ${table}
            ADD CONSTRAINT ${name} ${definition}
          `);
          console.log(`Constraint ${name} added to table ${table}`);
        } else {
          console.log(`Constraint ${name} already exists on table ${table}`);
        }
      } catch (err) {
        console.error(`Error processing constraint ${name} for table ${table}:`, err);
        throw err;
      }
    }

    await client.query('COMMIT');
    console.log("All constraints processed successfully");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error in createConstraints:", err);
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

      CREATE OR REPLACE FUNCTION contact_change() RETURNS TRIGGER AS $$
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

      CREATE OR REPLACE FUNCTION notify_interaction_change() RETURNS TRIGGER AS $$
      DECLARE
        payload json;
        field_values json;
      BEGIN
        SELECT json_object_agg(cf.field_name, ifv.value)
        INTO field_values
        FROM interaction_field_values ifv
        JOIN custom_fields cf ON cf.id = ifv.field_id
        WHERE ifv.interaction_id = NEW.id;

        payload = json_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'interaction_type', NEW.interaction_type,
          'created_at', NEW.created_at,
          'created_by', NEW.created_by,
          'field_values', field_values
        );
        PERFORM pg_notify('interaction_changes', payload::text);
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
      DROP TRIGGER IF EXISTS contact_change_trigger ON contacts;
      DROP TRIGGER IF EXISTS interaction_change_trigger ON interactions;

      CREATE TRIGGER update_users_timestamp
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();

      CREATE TRIGGER update_contacts_timestamp
      BEFORE UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();

      CREATE TRIGGER contact_change_trigger
      AFTER INSERT OR UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION contact_change();

      CREATE TRIGGER interaction_change_trigger
      AFTER INSERT OR UPDATE ON interactions
      FOR EACH ROW
      EXECUTE FUNCTION notify_interaction_change();
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
        i.interaction_type,
        i.created_at AS last_interaction_date,
        field_values.field_values
      FROM 
        contacts c
      LEFT JOIN LATERAL (
        SELECT id, interaction_type, contact_id, created_at
        FROM interactions
        WHERE contact_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) i ON true
      LEFT JOIN LATERAL (
        SELECT json_object_agg(cf.field_name, ifv.value) as field_values
        FROM interaction_field_values ifv
        JOIN custom_fields cf ON cf.id = ifv.field_id
        WHERE ifv.interaction_id = i.id
      ) field_values ON true;
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

      CREATE INDEX IF NOT EXISTS idx_interaction_field_values_interaction_id
      ON interaction_field_values(interaction_id);

      CREATE INDEX IF NOT EXISTS idx_custom_fields_section
      ON custom_fields(section);
    `);
    console.log("Indexes created successfully");
  } catch (err) {
    console.error("Error creating indexes:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function getClient() {
  return await pool.connect();
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client?.release();
  }
}

async function checkInitialized() {
  try {
    if (!pool) {
      console.log("Database pool not initialized");
      return false;
    }
    const result = await query("SELECT to_regclass('public.users') as exists");
    return !!result.rows[0].exists;
  } catch (error) {
    console.error("Error checking if database is initialized:", error);
    return false;
  }
}

async function closePool() {
  await pool.end();
}

async function insertDefaultCustomFields() {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO custom_fields (section, field_name, field_type, options, is_default)
      VALUES 
        ('canvass', 'Support Level', 'select', '["Strong Support", "Lean Support", "Undecided", "Lean Against", "Strong Against"]', true),
        ('canvass', 'Wants Sign', 'boolean', NULL, true),
        ('interaction', 'Interaction Type', 'select', '["Phone Call", "Door Knock", "Email", "Text Message", "Social Media", "Event"]', true),
        ('interaction', 'Notes', 'text', NULL, true),
        ('dispatch', 'Ride Status', 'select', '["Requested", "Scheduled", "En Route", "Completed", "Cancelled"]', true),
        ('dispatch', 'Voted', 'boolean', NULL, true)
      ON CONFLICT (section, field_name) DO UPDATE
      SET 
        field_type = EXCLUDED.field_type,
        options = EXCLUDED.options,
        is_default = EXCLUDED.is_default;
    `);
    console.log("Default custom fields inserted successfully");
  } catch (err) {
    console.error("Error inserting default custom fields:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function initializeDatabaseStructure() {
  try {
    await createTables();
    await createConstraints();
    await createFunctions();
    await createTriggers();
    await createViews();
    await createIndexes();
    await insertDefaultCustomFields();
    console.log("Database structure initialized successfully");
  } catch (error) {
    console.error("Error initializing database structure:", error);
    throw error;
  }
}
export {
  initializeDatabase,
  getClient,
  query,
  checkInitialized,
  closePool,
  initializeDatabaseStructure,
  pool
};