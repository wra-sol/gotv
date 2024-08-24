import { query, getClient } from "~/utils/db";

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
  'firstname', 'surname', 'email', 'phone', 'unit', 'street_name', 'street_number',
  'address', 'city', 'postal', 'external_id', 'electoral_district', 'poll_id',
  'voted', 'ride_status', 'last_contacted', 'last_contacted_by', 'created_by', 'updated_by'
];

function sanitizeContactData(contact: Partial<Contact>): Partial<Contact> {
  return Object.fromEntries(
    Object.entries(contact).filter(([key]) => contactColumns.includes(key))
  ) as Partial<Contact>;
}

export async function getContacts({ 
  offset = 0, 
  limit = 10, 
  filters = {}
}: { 
  offset?: number, 
  limit?: number, 
  filters?: {
    search?: string,
    rideStatus?: string,
    voted?: string,
    electoralDistrict?: string,
    pollId?: string,
    lastNameStartsWith?: string
  }
} = {}): Promise<{ contacts: Contact[], total: number }> {
  
  let whereClause = [];
  let params = [];
  let index = 1;
  
  if (filters.search) {
    whereClause.push(`(firstname ILIKE $${index} OR surname ILIKE $${index} OR email ILIKE $${index} OR phone ILIKE $${index})`);
    params.push(`%${filters.search}%`);
    index++;
  }
  
  if (filters.rideStatus) {
    whereClause.push(`ride_status = $${index}`);
    params.push(filters.rideStatus);
    index++;
  }
  
  if (filters.voted) {
    whereClause.push(`voted = $${index}`);
    params.push(filters.voted === 'true');
    index++;
  }
  
  if (filters.electoralDistrict) {
    whereClause.push(`electoral_district = $${index}`);
    params.push(filters.electoralDistrict);
    index++;
  }
  
  if (filters.pollId) {
    whereClause.push(`poll_id = $${index}`);
    params.push(filters.pollId);
    index++;
  }

  if (filters.lastNameStartsWith) {
    whereClause.push(`surname ILIKE $${index}`);
    params.push(`${filters.lastNameStartsWith}%`);
    index++;
  }
  
  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(" AND ")}` : "";
  
  const contactsResult = await query(
    `SELECT * FROM contacts ${whereString} LIMIT $${index} OFFSET $${index + 1}`,
    [...params, limit, offset]
  );
  
  const totalResult = await query(
    `SELECT COUNT(*) as total FROM contacts ${whereString}`,
    params
  );
  
  return { 
    contacts: contactsResult.rows, 
    total: parseInt(totalResult.rows[0].total) 
  };
}


export async function getContactById(id: number): Promise<Contact | undefined> {
  const result = await query("SELECT * FROM contacts WHERE id = $1", [id]);
  return result.rows[0];
}

export async function getUniqueGroupingValues(field: string): Promise<string[]> {
  const result = await query(`SELECT DISTINCT ${field} FROM contacts WHERE ${field} IS NOT NULL AND ${field} != '' ORDER BY ${field} ASC`);
  return result.rows.map(row => row[field]);
}

export async function getContactsByGroupingValue(groupingField: string, value: string): Promise<Contact[]> {
  const result = await query(`SELECT * FROM contacts WHERE ${groupingField} = $1`, [value]);
  return result.rows;
}

export async function createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">, userId: number): Promise<number> {
  const sanitizedContact = sanitizeContactData(contact);
  const columns = Object.keys(sanitizedContact).join(', ');
  const placeholders = Object.keys(sanitizedContact).map((_, index) => `$${index + 1}`).join(', ');
  const values = Object.values(sanitizedContact);

  const result = await query(
    `INSERT INTO contacts (${columns}, created_by, updated_by) 
     VALUES (${placeholders}, $${values.length + 1}, $${values.length + 2}) RETURNING id`,
    [...values, userId, userId]
  );
  return result.rows[0].id;
}

export async function createManyContacts(contacts: Omit<Contact, "id" | "created_at" | "updated_at">[], userId: number): Promise<number[]> {
  const client = await getClient();
  const insertedIds: number[] = [];

  try {
    await client.query('BEGIN');

    for (const contact of contacts) {
      const sanitizedContact = sanitizeContactData(contact);
      const columns = Object.keys(sanitizedContact).join(', ');
      const placeholders = Object.keys(sanitizedContact).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(sanitizedContact);

      const result = await client.query(
        `INSERT INTO contacts (${columns}, created_by, updated_by) 
         VALUES (${placeholders}, $${values.length + 1}, $${values.length + 2}) RETURNING id`,
        [...values, userId, userId]
      );
      insertedIds.push(result.rows[0].id);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return insertedIds;
}

export async function updateContact(id: number, contact: Partial<Contact>, userId: number): Promise<void> {
  const sanitizedContact = sanitizeContactData(contact);
  const entries = Object.entries(sanitizedContact);
  const setClause = entries.map(([key, _], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([_, value]) => value);
    console.log(values)
  await query(
    `UPDATE contacts SET ${setClause}, updated_by = $${values.length + 1}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 2}`,
    [...values, userId, id]
  );
}

export async function updateContactVotedStatus(contactId: number, voted: boolean): Promise<void> {
  try{await query(
    "UPDATE contacts SET voted = $1 WHERE id = $2",
    [voted, contactId]
  );}catch (error){
    console.error(error)
  }
}

export async function deleteContact(id: number): Promise<void> {
  await query("DELETE FROM contacts WHERE id = $1", [id]);
}

export async function pollForChanges(lastKnownChangeId: number): Promise<any[]> {
  const result = await query(
    `SELECT * FROM changes 
     WHERE id > $1 
     AND table_name = 'contacts'
     ORDER BY id ASC 
     LIMIT 100`,
    [lastKnownChangeId]
  );
  
  return result.rows;
}

export async function getLastChangeId(): Promise<number> {
  const result = await query('SELECT MAX(id) as "lastId" FROM changes WHERE table_name = $1', ['contacts']);
  return result.rows[0].lastId || 0;
}