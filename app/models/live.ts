import { getDb } from '~/utils/db';

export async function pollForChanges(lastKnownChangeId: number): Promise<any[]> {
  const db = await getDb();
  const changes = await db.all(
    `SELECT * FROM changes 
     WHERE id > ? 
     AND table_name = 'contacts'
     ORDER BY id ASC 
     LIMIT 100`,
    lastKnownChangeId
  );
  
  return changes;
}

export async function getLastChangeId(): Promise<number> {
  const db = await getDb();
  const result = await db.get('SELECT MAX(id) as lastId FROM changes WHERE table_name = "contacts"');
  return result.lastId || 0;
}