import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { db } from "./db";
import crypto from "crypto";

type User = { id: number; username: string };

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

// Password hashing function using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex');
}

// Password verification function
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hashedPassword;
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
    const user = await db.get("SELECT * FROM users WHERE id = ?", userId);
    if (userId && !user){
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
}) {
  const user = await db.get("SELECT * FROM users WHERE username = ?", username);
  if (!user) return null;
  const isCorrectPassword = await verifyPassword(password, user.password);
  if (!isCorrectPassword) return null;
  return { id: user.id, username };
}

export async function createUser(username: string, password: string) {
  const hashedPassword = await hashPassword(password);
  const result = await db.run(
    "INSERT INTO users (username, password, is_owner) VALUES (?, ?, false)",
    [username, hashedPassword]
  );
  return { id: result.lastID, username };
}
