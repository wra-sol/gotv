import { redirect, useLoaderData, Link } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getUser } from "~/utils/auth.server";
import { getContacts } from "~/models/contacts";
import { getSettings } from "~/models/settings";
import { checkInitialized, ensureConnection } from "~/utils/db.server";

export const loader: LoaderFunction = async ({ request }) => {
  const isInitialized = await checkInitialized();
  if (!isInitialized) {
    console.log("Database not initialized. Please run initialization script.");
    throw new Response("Database not initialized", { status: 500 });
  }

  const user = await getUser(request);
  if (!user) {
    return redirect("/login");
  }

  const client = await ensureConnection();
  try {
    const [contactCount, settings] = await Promise.all([
      getContacts({ limit: 1, sortKey:"id", sortDirection:"asc" }).then((result) => result.total),
      getSettings(),
    ]);

    return json({ user, contactCount, settings });
  } finally {
    client.release();
  }
};

export default function Index() {
  const { user, contactCount, settings } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">
        Welcome to {settings.name || "Your Application"}
      </h1>

      <p className="mb-4">Hello, {user.username}! Welcome back.</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">Dashboard</h2>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-lg mb-2">
            You currently have <span className="font-bold">{contactCount}</span>{" "}
            contacts in your database.
          </p>
          <Link to="/contacts" className="text-blue-600 hover:underline">
            Manage Contacts
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/contacts/new"
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 text-center"
          >
            Add New Contact
          </Link>
          <Link
            to="/settings"
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 text-center"
          >
            Adjust Settings
          </Link>
        </div>
      </section>

      {user.is_owner && (
        <section>
          <h2 className="text-2xl font-semibold mb-3">Admin Actions</h2>
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4"
            role="alert"
          >
            <p className="font-bold">Owner Access</p>
            <p>
              You have owner privileges. You can manage users and system
              settings.
            </p>
            <Link
              to="/users"
              className="text-yellow-700 font-bold hover:underline"
            >
              Manage Users
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
