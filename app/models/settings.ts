import { query } from "~/utils/db.server";
export interface Settings {
  theme: 'light' | 'dark';
  name: string;
  grouping_field: 'electoral_district' | 'poll_id' | 'none';
  database_type: 'postgres';
}

export interface CustomField {
  id: number;
  section: string;
  field_name: string;
  field_type: string;
  options: string[] | null;
  is_default: boolean;
}
export async function getSettings(): Promise<Settings> {
  const result = await query("SELECT * FROM settings");
  
  return result.rows.reduce((acc, { key, value }) => {
    try {
      acc[key] = JSON.parse(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>) as Settings;
}

export async function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
    [key, JSON.stringify(value)]
  );
}

export async function updateMultipleSettings(settings: Partial<Settings>): Promise<void> {
  const entries = Object.entries(settings);
  const placeholders = entries.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(", ");
  const values = entries.flatMap(([key, value]) => [key, JSON.stringify(value)]);

  await query(
    `INSERT INTO settings (key, value) VALUES ${placeholders} 
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    values
  );
}

export async function getCustomFields(section: string) {
  const result = await query(
    "SELECT * FROM custom_fields WHERE section = $1 ORDER BY id",
    [section]
  );
  return result.rows.map(row => ({
    ...row,
    options: row.options ? JSON.parse(row.options) : undefined
  }));
}

export async function addCustomField(field: Omit<CustomField, 'id'>): Promise<void> {
  const { section, field_name, field_type, options, is_default } = field;
  await query(
    `INSERT INTO custom_fields (section, field_name, field_type, options, is_default) 
     VALUES ($1, $2, $3, $4, $5)`,
    [section, field_name, field_type, options ? JSON.stringify(options) : null, is_default]
  );
}

export async function updateCustomField(id: number, field: Partial<CustomField>): Promise<void> {
  const { section, field_name, field_type, options, is_default } = field;
  await query(
    `UPDATE custom_fields 
     SET section = COALESCE($1, section), 
         field_name = COALESCE($2, field_name), 
         field_type = COALESCE($3, field_type), 
         options = COALESCE($4, options),
         is_default = COALESCE($5, is_default)
     WHERE id = $5`,
    [section, field_name, field_type, options ? JSON.stringify(options) : null, is_default, id]
  );
}

export async function deleteCustomField(id: number): Promise<void> {
  await query("DELETE FROM custom_fields WHERE id = $1", [id]);
}