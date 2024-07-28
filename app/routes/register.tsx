import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { getUserByUserName } from "~/models/users";
import { createUser, createUserSession, getUserId } from "~/utils/auth.server";

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return json({});
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  const existingUser = await getUserByUserName(username);
  if (existingUser) {
    return json({ error: "Username already exists" }, { status: 400 });
  }

  const user = await createUser(username, password);
  if (!user) {
    return json({ error: "Error creating user" }, { status: 500 });
  }

  return createUserSession(user.id, "/");
};

export default function SignUp() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="username" className="block mb-1">Username:</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="password" className="block mb-1">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className="w-full p-2 border rounded"
          />
        </div>
        {actionData?.error && (
          <p className="text-red-500">{actionData.error}</p>
        )}
        <button type="submit" className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600">
          Sign Up
        </button>
      </Form>
    </div>
  );
}