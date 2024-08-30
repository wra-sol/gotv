import { CanvassList, CanvassListRule } from "~/routes/settings.canvass";
import { query, getClient } from "~/utils/db.server";


export async function createCanvassList(
  name: string,
  description: string | null,
  userId: number
): Promise<CanvassList> {
  const result = await query(
    `INSERT INTO canvass_lists (name, description, created_by, updated_by)
     VALUES ($1, $2, $3, $3)
     RETURNING *`,
    [name, description, userId]
  );
  return result.rows[0];
}

export async function getCanvassLists(): Promise<CanvassList[]> {
  const result = await query("SELECT * FROM canvass_lists ORDER BY name");
  return result.rows;
}

export async function updateCanvassList(
  id: number,
  updates: Partial<CanvassList>,
  userId: number
): Promise<CanvassList | null> {
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(", ");
  const values = Object.values(updates);

  const result = await query(
    `UPDATE canvass_lists
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP, updated_by = $1
     WHERE id = $${values.length + 2}
     RETURNING *`,
    [userId, ...values, id]
  );
  return result.rows[0] || null;
}

export async function deleteCanvassList(id: number): Promise<void> {
  await query("DELETE FROM canvass_lists WHERE id = $1", [id]);
}

export async function addRuleToCanvassList(
  canvassListId: number,
  fieldName: string,
  operator: string,
  value: string
): Promise<CanvassListRule> {
  const result = await query(
    `INSERT INTO canvass_list_rules (canvass_list_id, field_name, operator, value)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [canvassListId, fieldName, operator, value]
  );
  return result.rows[0];
}

export async function getRulesForCanvassList(canvassListId: number): Promise<CanvassListRule[]> {
  const result = await query(
    "SELECT * FROM canvass_list_rules WHERE canvass_list_id = $1",
    [canvassListId]
  );
  return result.rows;
}

export async function deleteRuleFromCanvassList(ruleId: number): Promise<void> {
  await query("DELETE FROM canvass_list_rules WHERE id = $1", [ruleId]);
}