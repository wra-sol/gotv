import { getDb } from "~/utils/db";

export interface Settings {
  theme: 'light' | 'dark';
  name: string;
  grouping_field: 'electoral_district' | 'poll_id' | 'none';
  database_type: 'sqlite' | 'postgres';
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const settings = await db.all("SELECT * FROM settings");
  
  return settings.reduce((acc, { key, value }) => {
    try {
      acc[key] = JSON.parse(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>) as Settings;
}

export async function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = await getDb();
  await db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, JSON.stringify(value)]
  );
}

export async function updateMultipleSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const placeholders = Object.keys(settings).map(() => "(?, ?)").join(", ");
  const values = Object.entries(settings).flatMap(([key, value]) => [key, JSON.stringify(value)]);

  await db.run(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ${placeholders}`,
    values
  );
}