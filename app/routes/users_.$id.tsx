import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { getUserById, updateUser } from "~/models/users";
import { requireUserId } from "~/utils/auth.server";

type LoaderData = {
  user: { id: number; username: string; is_owner: boolean };
};

type ActionData = {
  errors?: {
    username?: string;
  };
};

export const loader: LoaderFunction = async ({ params, request }) => {
  await requireUserId(request);
  const user = await getUserById(Number(params.id));
  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }
  return json<LoaderData>({ user });
};

export const action: ActionFunction = async ({ request, params }) => {
  await requireUserId(request);
  const formData = await request.formData();
  const username = formData.get("username");

  if (typeof username !== "string" || username.length === 0) {
    return json<ActionData>({ errors: { username: "Username is required" } }, { status: 400 });
  }

  await updateUser(Number(params.id), { username });
  return redirect("/users");
};

export default function UserDetail() {
  const { user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  return (
    <div>
      <h2 className="text-2xl mb-4">Edit User: {user.username}</h2>
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="username" className="block mb-1">Username:</label>
          <input
            type="text"
            id="username"
            name="username"
            defaultValue={user.username}
            className="w-full px-2 py-1 border rounded"
          />
          {actionData?.errors?.username && (
            <p className="text-red-500">{actionData.errors.username}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">
            <input
              type="checkbox"
              name="is_owner"
              defaultChecked={user.is_owner}
              className="mr-2"
            />
            Is Owner
          </label>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Update User
        </button>
      </Form>
    </div>
  );
}