import { query } from "~/utils/db";

export interface Interaction {
  id: number;
  contact_id: number;
  interaction_type: string;
  support_level?: string;
  wants_sign?: boolean;
  will_volunteer?: boolean;
  plan_to_vote?: string;
  notes?: string;
  created_at: Date;
  created_by: number;
}

export async function createInteraction(interaction: Omit<Interaction, "id" | "created_at">, userId: number): Promise<number> {
  const { contact_id, interaction_type, support_level, wants_sign, will_volunteer, plan_to_vote, notes } = interaction;
  const result = await query(
    `INSERT INTO interactions 
     (contact_id, interaction_type, support_level, wants_sign, will_volunteer, plan_to_vote, notes, created_by) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING id`,
    [contact_id, interaction_type, support_level, wants_sign, will_volunteer, plan_to_vote, notes, userId]
  );
  return result.rows[0].id;
}

export async function getInteractionsByContactId(contactId: number): Promise<Interaction[]> {
  const result = await query(
    "SELECT * FROM interactions WHERE contact_id = $1 ORDER BY created_at DESC",
    [contactId]
  );
  return result.rows;
}

export async function getLatestInteractionByContactId(contactId: number): Promise<Interaction | null> {
  const result = await query(
    "SELECT * FROM interactions WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 1",
    [contactId]
  );
  return result.rows[0] || null;
}

export async function updateInteraction(id: number, interactionData: Partial<Interaction>): Promise<void> {
  const { contact_id, interaction_type, support_level, wants_sign, will_volunteer, plan_to_vote, notes } = interactionData;
  await query(
    `UPDATE interactions 
     SET contact_id = $1, interaction_type = $2, support_level = $3, wants_sign = $4, 
         will_volunteer = $5, plan_to_vote = $6, notes = $7
     WHERE id = $8`,
    [contact_id, interaction_type, support_level, wants_sign, will_volunteer, plan_to_vote, notes, id]
  );
}

export async function deleteInteraction(id: number): Promise<void> {
  await query("DELETE FROM interactions WHERE id = $1", [id]);
}