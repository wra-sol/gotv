import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useNavigation,
  useActionData,
  useLocation,
  useOutlet,
  NavLink,
  Outlet,
} from "@remix-run/react";
import {
  getSettings,
  updateMultipleSettings,
  type Settings,
} from "~/models/settings";


type LoaderData = {
  settings: Settings;
  error:string;
};


export const loader: LoaderFunction = async () => {
  try {
    const settings = await getSettings();
    return json({ settings });
  } catch (error) {
    console.error("Error in loader:", error);
    return json(
      { settings: {}, error: "Failed to load settings" },
      { status: 500 }
    );
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  try {
    const theme = formData.get("theme") as string;
    const grouping_field = formData.get("grouping_field") as string;
    const name = formData.get("name") as string;
    await updateMultipleSettings({ theme, grouping_field, name });
    return json({ success: true });
  } catch (error) {
    console.error("Error in action:", error);
    return json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
};

export default function Settings() {
  const outlet = useOutlet();
  const location = useLocation();
  const { settings, error } = useLoaderData<LoaderData>();
  const actionData = useActionData();
  const navigation = useNavigation();

  const navItems = [
    { to: "/settings/", label: "General" },
    { to: "/settings/contacts", label: "Contacts" },
    { to: "/settings/canvass", label: "Canvass" },
    { to: "/settings/scrutineer", label: "Scrutineer" },
    { to: "/settings/dispatch", label: "Dispatch" },
  ];

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Settings</h1>
      <nav className="mb-4">
        <ul className="flex space-x-4">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={`p-2 rounded ${
                  location.pathname === item.to
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {outlet ? (
        <Outlet />
      ) : (
        <div>
          <h2 className="text-2xl mb-4">General Settings</h2>
          {(error || actionData?.error) && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
              role="alert"
            >
              <strong className="font-bold">Error!</strong>
              <span className="block sm:inline">
                {" "}
                {error || actionData.error}
              </span>
            </div>
          )}
          <Form method="post" className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-1">
                App Name:
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={settings.name}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="theme" className="block mb-1">
                Theme:
              </label>
              <select
                id="theme"
                name="theme"
                defaultValue={settings.theme}
                className="w-full p-2 border rounded"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label htmlFor="grouping_field" className="block mb-1">
                Group Contacts By:
              </label>
              <select
                id="grouping_field"
                name="grouping_field"
                defaultValue={settings.grouping_field}
                className="w-full p-2 border rounded"
              >
                <option value="poll_id">Poll ID</option>
                <option value="electoral_district">Electoral District</option>
                <option value="none">None</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={navigation.state === "submitting"}
            >
              {navigation.state === "submitting"
                ? "Saving..."
                : "Save Settings"}
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
