import { getDb } from "~/utils/db";

export async function getUsers() {
  const db = await getDb();
  return db.all("SELECT id, username, is_owner FROM users");
}

export async function getUserById(id: number) {
  const db = await getDb();
  return db.get("SELECT id, username, is_owner FROM users WHERE id = ?", id);
}

export async function getUserByUserName(name:string){
  const db = await getDb();
  return db.get("SELECT id, username, is_owner FROM users WHERE username = ?", name);
}

export async function createUser({ username, password }: { username: string; password: string }) {
  const db = await getDb();
  return db.run(
    "INSERT INTO users (username, password, is_owner) VALUES (?, ?, ?)",
    [username, password, false]
  );
}
