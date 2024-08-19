import { getDb } from "~/utils/db";

export interface Contact {
  id: number;
  firstname: string;
  surname: string;
  email?: string;
  unit?: string;
  street_name?: string;
  street_number?: string;
  address?: string;
  city?: string;
  postal?: string;
  phone?: string;
  external_id?: string;
  electoral_district?: string;
  poll_id?: string;
  last_contacted: string;
  last_contacted_by: string;
  ride_status: string;
  voted: boolean;
  created_at: Date;
  created_by: number;
  updated_at: Date;
  updated_by: number;
}
const contactColumns = [
  'firstname',
  'surname',
  'email',
  'phone',
  'unit',
  'street_name',
  'street_number',
  'address',
  'city',
  'postal',
  'external_id',
  'electoral_district',
  'poll_id',
  'voted',
  'ride_status',
  'last_contacted',
  'last_contacted_by',
  'created_by',
  'updated_by'
];

function sanitizeContactData(contact: Partial<Contact>): Partial<Contact> {
  return Object.fromEntries(
    Object.entries(contact).filter(([key]) => contactColumns.includes(key))
  ) as Partial<Contact>;
}
export async function getContacts({ 
  offset = 0, 
  limit = 10, 
  filters 
}: { 
  offset?: number, 
  limit?: number, 
  filters: {
    search?: string,
    rideStatus?: string,
    voted?: string,
    electoralDistrict?: string,
    pollId?: string,
    lastNameStartsWith?: string
  }
} = { filters: {} }): Promise<{ contacts: Contact[], total: number }> {
  const db = await getDb();
  
  let whereClause = [];
  let params = [];
  
  if (filters.search) {
    whereClause.push("(firstname LIKE ? OR surname LIKE ? OR email LIKE ? OR phone LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }
  
  if (filters.rideStatus) {
    whereClause.push("ride_status = ?");
    params.push(filters.rideStatus);
  }
  
  if (filters.voted) {
    whereClause.push("voted = ?");
    params.push(filters.voted === 'true' ? 1 : 0);
  }
  
  if (filters.electoralDistrict) {
    whereClause.push("electoral_district = ?");
    params.push(filters.electoralDistrict);
  }
  
  if (filters.pollId) {
    whereClause.push("poll_id = ?");
    params.push(filters.pollId);
  }

  if (filters.lastNameStartsWith) {
    whereClause.push("surname LIKE ?");
    params.push(`${filters.lastNameStartsWith}%`);
  }
  
  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(" AND ")}` : "";
  
  const contacts = await db.all(
    `SELECT * FROM contacts ${whereString} ORDER BY surname ASC, firstname ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const [{ total }] = await db.all(
    `SELECT COUNT(*) as total FROM contacts ${whereString}`,
    params
  );
  
  return { contacts, total };
}
export async function getContactById(id: number): Promise<Contact | undefined> {
  const db = await getDb();
  return db.get("SELECT * FROM contacts WHERE id = ?", id);
}

export async function getUniqueGroupingValues(field: string): Promise<string[]> {
  const db = await getDb();
  const result = await db.all(`SELECT DISTINCT ${field} FROM contacts WHERE ${field} IS NOT NULL AND ${field} != '' ORDER BY ${field} ASC`);
  return result.map(row => row[field]);
}

export async function getContactsByGroupingValue(groupingField: string, value: string): Promise<Contact[]> {
  const db = await getDb();
  return db.all(`SELECT * FROM contacts WHERE ${groupingField} = ?`, value);
}

export async function createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">, userId: number): Promise<number> {
  const db = await getDb();
  const sanitizedContact = sanitizeContactData(contact);
  const columns = Object.keys(sanitizedContact).join(', ');
  const placeholders = Object.keys(sanitizedContact).map(() => '?').join(', ');
  const values = Object.values(sanitizedContact);

  const result = await db.run(
    `INSERT INTO contacts (${columns}, created_by, updated_by) 
     VALUES (${placeholders}, ?, ?)`,
    [...values, userId, userId]
  );
  return result.lastID;
}

export async function createManyContacts(contacts: Omit<Contact, "id" | "created_at" | "updated_at">[], userId: number): Promise<number[]> {
  const db = await getDb();
  const insertedIds: number[] = [];

  await db.run('BEGIN TRANSACTION');

  try {
    for (const contact of contacts) {
      const sanitizedContact = sanitizeContactData(contact);
      console.log(contact)
      const columns = Object.keys(sanitizedContact).join(', ');
      const placeholders = Object.keys(sanitizedContact).map(() => '?').join(', ');
      const values = Object.values(sanitizedContact);

      const result = await db.run(
        `INSERT INTO contacts (${columns}, created_by, updated_by) 
         VALUES (${placeholders}, ?, ?)`,
        [...values, userId, userId]
      );
      insertedIds.push(result.lastID);
    }

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  return insertedIds;
}
export async function updateContact(id: number, contact: Partial<Contact>, userId: number): Promise<void> {
  const db = await getDb();
  const sanitizedContact = sanitizeContactData(contact);
  const entries = Object.entries(sanitizedContact);
  const setClause = entries.map(([key, _]) => `${key} = ?`).join(', ');
  const values = entries.map(([_, value]) => value);
  
  await db.run(
    `UPDATE contacts SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, userId, id]
  );
}

export async function updateContactVotedStatus(contactId: number, voted: boolean): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE contacts SET voted = ? WHERE id = ?",
    [voted ? 1 : 0, contactId]
  );
}

export async function deleteContact(id: number): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM contacts WHERE id = ?", id);
}