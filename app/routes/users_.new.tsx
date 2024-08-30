import { useState } from "react";
import type { ActionFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import { createUser } from "~/models/users";
import { requireUserId } from "~/utils/auth.server";

type ActionData = {
  errors?: {
    username?: string;
    password?: string;
  };
};

export const action: ActionFunction = async ({ request }) => {
  await requireUserId(request);
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || username.length === 0) {
    return json<ActionData>({ errors: { username: "Username is required" } }, { status: 400 });
  }

  if (typeof password !== "string" || password.length === 0) {
    return json<ActionData>({ errors: { password: "Password is required" } }, { status: 400 });
  }

  await createUser({ username, password });
  return redirect("/users");
};

export default function NewUser() {
  const actionData = useActionData<ActionData>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div>
      <h2 className="text-2xl mb-4">Add New User</h2>
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="username" className="block mb-1">Username:</label>
          <input
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-2 py-1 border rounded"
          />
          {actionData?.errors?.username && (
            <p className="text-red-500">{actionData.errors.username}</p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block mb-1">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-2 py-1 border rounded"
          />
          {actionData?.errors?.password && (
            <p className="text-red-500">{actionData.errors.password}</p>
          )}
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Create User
        </button>
      </Form>
    </div>
  );
}