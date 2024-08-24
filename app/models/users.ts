import { query } from "~/utils/db";

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