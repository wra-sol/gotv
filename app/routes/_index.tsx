import { redirect, useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getUser } from "~/utils/auth.server";
import { checkInitialized } from "~/utils/db";

export const loader: LoaderFunction = async ({ request }) => {
  const isInitialized = await checkInitialized();
  if (!isInitialized) {
    return redirect("/setup");
  }

  const user = await getUser(request);
  return json({ user });
};

export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Your Application</h1>
      
      {user ? (
        <p className="mb-4">Hello, {user.username}! Welcome back.</p>
      ) : (
        <p className="mb-4">Please sign in to access all features.</p>
      )}

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">About This Application</h2>
        <p>
          This is a powerful tool designed to help you manage contacts and user information efficiently. 
          Navigate through the sidebar to explore different features.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-3">Quick Links</h2>
        <ul className="list-disc list-inside">
          <li>Manage your contacts</li>
          <li>View and edit user profiles</li>
          <li>Adjust application settings</li>
        </ul>
      </section>
    </div>
  );
}