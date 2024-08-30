import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { getUsers } from "~/models/users";
import { requireUserId } from "~/utils/auth.server";

type LoaderData = {
  users: Array<{ id: number; username: string; is_owner: boolean }>;
};

export const loader: LoaderFunction = async ({ request }) => {
  await requireUserId(request);
  const users = await getUsers();
  return json({ users });
};

export default function Users() {
  const { users } = useLoaderData<LoaderData>();

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Users</h1>
      <Link 
        to="/users/new" 
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4"
      >
        Add New User
      </Link>
      <div className="flex">
        <ul className="w-1/3 mr-4 space-y-2">
          {users.map((user) => (
            <li key={user.id} className="border p-2 rounded">
              <Link 
                to={`/users/${user.id}`} 
                className="text-blue-600 hover:underline"
              >
                {user.username}
              </Link>
              {user.is_owner && <span className="ml-2 text-sm text-gray-500">(Owner)</span>}
            </li>
          ))}
        </ul>
        <div className="w-2/3">
          <Outlet />
        </div>
      </div>
    </div>
  );
}