import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { checkInitialized, initializeDatabase } from "~/utils/db";
import { createUserSession, getUser, login } from "~/utils/auth.server";
import { getContacts } from "~/models/contacts";
import { getSettings } from "~/models/settings";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const ownerUsername = formData.get("ownerUsername");
  const ownerPassword = formData.get("ownerPassword");
  const pgHost = formData.get("pgHost");
  const pgPort = formData.get("pgPort");
  const pgDatabase = formData.get("pgDatabase");
  const pgUser = formData.get("pgUser");
  const pgPassword = formData.get("pgPassword");

  const errors: Record<string, string> = {};
  if (typeof ownerUsername !== "string" || ownerUsername.length < 3) {
    errors.ownerUsername = "Username must be at least 3 characters long";
  }
  if (typeof ownerPassword !== "string" || ownerPassword.length < 8) {
    errors.ownerPassword = "Password must be at least 8 characters long";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  const isInitialized = await checkInitialized();
  if (isInitialized) {
    return redirect("/");
  }

  try {
    await initializeDatabase({
      host: pgHost as string,
      port: parseInt(pgPort as string, 10),
      database: pgDatabase as string,
      user: pgUser as string,
      password: pgPassword as string,
    });

    const user = await login({
      username: ownerUsername as string,
      password: ownerPassword as string,
    });
    if (!user) {
      throw new Error("Failed to create owner user");
    }

    return createUserSession(user.id, "/");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    return json({ error: "Failed to initialize database. Please check your inputs and try again." }, { status: 500 });
  }
};

export const loader: LoaderFunction = async ({ request }) => {
  const isInitialized = await checkInitialized();
  if (isInitialized) {
    return redirect("/");
  }

  const user = await getUser(request);
  if (!user) {
    return redirect("/login");
  }

  try {
    const [{ contacts, total }, settings] = await Promise.all([
      getContacts({ limit: 10 }),
      getSettings(),
    ]);

    return json({ user, contactCount: total, settings });
  } catch (error) {
    console.error("Error loading data:", error);
    return json({ user, contactCount: 0, settings: {} }, { status: 500 });
  }
};

export default function Setup() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Set up Your New Instance</h1>
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="ownerUsername" className="block mb-1">
            Owner Username:
          </label>
          <input
            type="text"
            id="ownerUsername"
            name="ownerUsername"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="ownerPassword" className="block mb-1">
            Owner Password:
          </label>
          <input
            type="password"
            id="ownerPassword"
            name="ownerPassword"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="pgHost" className="block mb-1">
            PostgreSQL Host:
          </label>
          <input
            type="text"
            id="pgHost"
            name="pgHost"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="pgPort" className="block mb-1">
            PostgreSQL Port:
          </label>
          <input
            type="number"
            id="pgPort"
            name="pgPort"
            required
            defaultValue="5432"
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="pgDatabase" className="block mb-1">
            PostgreSQL Database Name:
          </label>
          <input
            type="text"
            id="pgDatabase"
            name="pgDatabase"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="pgUser" className="block mb-1">
            PostgreSQL Username:
          </label>
          <input
            type="text"
            id="pgUser"
            name="pgUser"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="pgPassword" className="block mb-1">
            PostgreSQL Password:
          </label>
          <input
            type="password"
            id="pgPassword"
            name="pgPassword"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Initialize Instance
        </button>
      </Form>
      {actionData?.error && (
        <p className="text-red-500 mt-4">{actionData.error}</p>
      )}
    </div>
  );
}
