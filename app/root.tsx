import type { LinksFunction, LoaderFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  Link,
  Form,
} from "@remix-run/react";
import { json } from "@remix-run/node";
import stylesheet from "./tailwind.css?url";
import { getUser } from "~/utils/auth.server";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesheet }];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const user = await getUser(request);
    return json({
      user,
    });
  } catch (error) {
    console.error("Root loader issue", error);
    return json({}, 500);
  }
};

export default function App() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <div className="flex h-full">
          <nav className="w-64 bg-gray-100 p-4">
            <ul className="space-y-2">
              {user ? (
                <>
                  <li>
                    <Link to="/" className="text-blue-600 hover:underline">
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link to="/users" className="text-blue-600 hover:underline">
                      Users
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/contacts"
                      className="text-blue-600 hover:underline"
                    >
                      Contacts
                    </Link>
                  </li>

                  <li>
                    <Link to="/gotv" className="text-blue-600 hover:underline">
                      GOTV Campaigns
                    </Link>
                  </li>
                  <li>
                    <Link to="/dispatch" className="text-blue-600 hover:underline">
                      Dispatch
                    </Link>
                  </li>
                  <li>
                    <Link to="/canvass" className="text-blue-600 hover:underline">
                      Canvass
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/settings"
                      className="text-blue-600 hover:underline"
                    >
                      Settings
                    </Link>
                  </li>
                  <li>
                    <Form action="/logout" method="post">
                      <button
                        type="submit"
                        className="text-blue-600 hover:underline"
                      >
                        Logout
                      </button>
                    </Form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="text-blue-600 hover:underline">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/register"
                      className="text-blue-600 hover:underline"
                    >
                      Sign Up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
