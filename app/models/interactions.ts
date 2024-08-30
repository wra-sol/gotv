import { query, getClient } from "~/utils/db.server";

export interface Interaction {
  id: number;
  contact_id: number;
  interaction_type: string;
  created_at: Date;
  created_by: number;
  custom_fields?: Record<string, any>;
}

export async function createInteraction(
  interaction: Omit<Interaction, "id" | "created_at">,
  userId: number
): Promise<Interaction> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { contact_id, interaction_type, custom_fields } = interaction;
    const result = await client.query(
      `INSERT INTO interactions 
       (contact_id, interaction_type, created_by) 
       VALUES ($1, $2, $3) 
       RETURNING id, contact_id, interaction_type, created_at, created_by`,
      [contact_id, interaction_type, userId]
    );

    const interactionId = result.rows[0].id;

    if (custom_fields) {
      for (const [fieldName, value] of Object.entries(custom_fields)) {
        await client.query(
          `INSERT INTO interaction_field_values (interaction_id, field_id, value)
           SELECT $1, id, $2 FROM custom_fields WHERE field_name = $3 AND (section = 'interactions' OR section = 'canvass')`,
          [interactionId, value, fieldName]
        );
      }
    }

    const completeInteraction = await client.query(
      `SELECT i.*, 
              json_object_agg(cf.field_name, ifv.value) AS custom_fields
       FROM interactions i
       LEFT JOIN interaction_field_values ifv ON i.id = ifv.interaction_id
       LEFT JOIN custom_fields cf ON ifv.field_id = cf.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [interactionId]
    );
    console.log(completeInteraction.rows[0])
    await client.query('COMMIT');
    return completeInteraction.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function getInteractionsByContactId(contactId: number): Promise<Interaction[]> {
  const result = await query(
    "SELECT * FROM interactions WHERE contact_id = $1 ORDER BY created_at DESC",
    [contactId]
  );

  const interactions = result.rows;

  for (const interaction of interactions) {
    const customFieldsResult = await query(
      "SELECT cf.field_name, ifv.value FROM interaction_field_values ifv JOIN custom_fields cf ON ifv.field_id = cf.id WHERE ifv.interaction_id = $1",
      [interaction.id]
    );
    interaction.custom_fields = customFieldsResult.rows.reduce((acc, row) => {
      acc[row.field_name] = row.value;
      return acc;
    }, {});
  }

  return interactions;
}

export async function getLatestInteractionByContactId(contactId: number): Promise<Interaction | null> {
  const result = await query(
    `SELECT 
       i.*,
       jsonb_object_agg(cf.field_name, ifv.value) AS custom_fields
     FROM interactions i
     LEFT JOIN interaction_field_values ifv ON i.id = ifv.interaction_id
     LEFT JOIN custom_fields cf ON ifv.field_id = cf.id
     WHERE i.contact_id = $1
       AND (cf.section = 'interactions' OR cf.section = 'canvass')
     GROUP BY i.id
     ORDER BY i.created_at DESC
     LIMIT 1`,
    [contactId]
  );
  const interaction = result.rows[0] || null;
  
  return interaction;
}

export async function updateInteraction(
  interactionId: number, 
  updates: Partial<Interaction>, 
  customFields: Record<string, any>,
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const interactionFields = ['contact_id', 'interaction_type', 'updated_by', 'updated_at'];
    const fieldsToUpdate = Object.keys(updates).filter(field => interactionFields.includes(field));
    if (fieldsToUpdate.length > 0) {
      const setClause = fieldsToUpdate.map((field, idx) => `${field} = $${idx + 2}`).join(', ');
      const values = [interactionId, ...fieldsToUpdate.map(field => updates[field])];

      await client.query(
        `UPDATE interactions 
         SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        values
      );
    }

    const customFieldEntries = Object.entries(customFields);
    if (customFieldEntries.length > 0) {
      const insertOrUpdateQuery = `
        INSERT INTO interaction_field_values (interaction_id, field_id, value)
        SELECT $1, cf.id, $2
        FROM custom_fields cf
        WHERE cf.field_name = $3 AND cf.section IN ('canvass', 'interaction')
        ON CONFLICT (interaction_id, field_id) DO UPDATE SET value = $2
      `;
      for (const [fieldName, value] of customFieldEntries) {
        await client.query(insertOrUpdateQuery, [interactionId, value, fieldName]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error during updateInteraction:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function bulkCreateOrUpdateInteractions(
  changes: Array<{
    contactId: number;
    custom_fields: Record<string, any>;
  }>,
  userId: number
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    for (const change of changes) {
      const { contactId, custom_fields } = change;
      const latestInteraction = await getLatestInteractionByContactId(contactId);

      if (!latestInteraction || latestInteraction.created_at < twoHoursAgo) {
        const result = await client.query(
          `INSERT INTO interactions 
           (contact_id, interaction_type, created_by) 
           VALUES ($1, $2, $3) 
           RETURNING id`,
          [contactId, 'canvass', userId]
        );

        const interactionId = result.rows[0].id;

        for (const [fieldName, value] of Object.entries(custom_fields)) {
          await client.query(
            `INSERT INTO interaction_field_values (interaction_id, field_id, value)
             SELECT $1, id, $2 FROM custom_fields WHERE field_name = $3 AND (section = 'interactions' OR section = 'canvass')`,
            [interactionId, value, fieldName]
          );
        }
      } else {
        const interactionId = latestInteraction.id;

        for (const [fieldName, value] of Object.entries(custom_fields)) {
          await client.query(
            `INSERT INTO interaction_field_values (interaction_id, field_id, value)
             SELECT $1, cf.id, $2
             FROM custom_fields cf
             WHERE cf.field_name = $3 AND cf.section IN ('canvass', 'interaction')
             ON CONFLICT (interaction_id, field_id) DO UPDATE SET value = $2`,
            [interactionId, value, fieldName]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error during bulk create or update interactions:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteInteraction(id: number): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM interaction_field_values WHERE interaction_id = $1", [id]);
    await client.query("DELETE FROM interactions WHERE id = $1", [id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} 

