import { useState } from "react";
import type { ActionFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { checkInitialized, initializeDatabase } from "~/utils/db";
import { createUserSession, login } from "~/utils/auth.server";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const ownerUsername = formData.get("ownerUsername");
  const ownerPassword = formData.get("ownerPassword");
  const dbType = formData.get("dbType");

  if (
    typeof ownerUsername !== "string" ||
    typeof ownerPassword !== "string" ||
    typeof dbType !== "string"
  ) {
    return json({ error: "Invalid form data" }, { status: 400 });
  }
  const isInitialized = await checkInitialized();
  if (isInitialized) {
    return redirect("/");
  }

  try {
    await initializeDatabase({ ownerUsername, ownerPassword, dbType });
    const user = await login({ username: ownerUsername, password: ownerPassword });
    return createUserSession(user.id, "/");
  } catch (error) {
    return json({ error: "Failed to initialize database" }, { status: 500 });
  }
};

export default function Setup() {
  const actionData = useActionData<typeof action>();
  const [dbType, setDbType] = useState("sqlite");
  
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
          <label htmlFor="dbType" className="block mb-1">
            Database Type:
          </label>
          <select
            id="dbType"
            name="dbType"
            value={dbType}
            onChange={(e) => setDbType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="sqlite">SQLite</option>
            <option value="postgres">PostgreSQL</option>
          </select>
        </div>
        {dbType === "postgres" && (
          <div className="space-y-2">
            <input
              type="text"
              name="pgHost"
              placeholder="PostgreSQL Host"
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              name="pgPort"
              placeholder="PostgreSQL Port"
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              name="pgDatabase"
              placeholder="PostgreSQL Database Name"
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              name="pgUser"
              placeholder="PostgreSQL Username"
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              name="pgPassword"
              placeholder="PostgreSQL Password"
              className="w-full p-2 border rounded"
            />
          </div>
        )}
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
