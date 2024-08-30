import { query } from "~/utils/db.server";


export async function getUsers() {
  const result = await query("SELECT id, username, is_owner FROM users");
  return result.rows;
}

export async function getUserById(id: number) {
  const result = await query("SELECT id, username, is_owner FROM users WHERE id = $1", [id]);
  return result.rows[0];
}

export async function getUserByUserName(name: string) {
  const result = await query("SELECT id, username, is_owner FROM users WHERE username = $1", [name]);
  return result.rows[0];
}

export async function createUser({ username, password }: { username: string; password: string }) {
  const result = await query(
    "INSERT INTO users (username, password, is_owner) VALUES ($1, $2, $3) RETURNING id",
    [username, password, false]
  );
  return result.rows[0].id;
}
export async function updateUser(id: number, { username, is_owner }: { username?: string; is_owner?: boolean }) {
  const updates = [];
  const values = [];
  let paramCounter = 1;

  if (username !== undefined) {
    updates.push(`username = $${paramCounter}`);
    values.push(username);
    paramCounter++;
  }

  if (is_owner !== undefined) {
    updates.push(`is_owner = $${paramCounter}`);
    values.push(is_owner);
    paramCounter++;
  }

  if (updates.length === 0) {
    return; // No updates to perform
  }

  values.push(id);

  await query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCounter}`,
    values
  );
}
