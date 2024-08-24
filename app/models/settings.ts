import { query } from "~/utils/db";

export interface Settings {
  theme: 'light' | 'dark';
  name: string;
  grouping_field: 'electoral_district' | 'poll_id' | 'none';
  database_type: 'postgres';
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