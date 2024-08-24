import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { query } from "./db";
import crypto from "crypto";

type User = { id: number; username: string; is_owner: boolean };

// Adjust these as needed for your application
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

// Password hashing function using crypto module
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ':' + derivedKey.toString('hex'));
    });
  });
}

// Password verification function
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hashedPassword.split(':');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

export async function createUserSession(userId: number, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  if (!session) return null;
  const userId = session.get("userId");
  if (!userId || typeof userId !== "number") return null;
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "number") {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "number") {
    return null;
  }

  try {
    const result = await query("SELECT id, username, is_owner FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (userId && !user) {
      return logout(request);
    }
    return user;
  } catch {
    return logout(request);
  }
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

export async function login({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<User | null> {
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  const user = result.rows[0];
  if (!user) return null;
  const isCorrectPassword = await verifyPassword(password, user.password);
  if (!isCorrectPassword) return null;
  return { id: user.id, username: user.username, is_owner: user.is_owner };
}

export async function createUser(username: string, password: string): Promise<User> {
  const hashedPassword = await hashPassword(password);
  const result = await query(
    "INSERT INTO users (username, password, is_owner) VALUES ($1, $2, false) RETURNING id, username, is_owner",
    [username, hashedPassword]
  );
  return result.rows[0];
}