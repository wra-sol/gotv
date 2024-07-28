import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import {
  getSettings,
  updateMultipleSettings,
} from "~/models/settings";

type LoaderData = {
  settings: {
    database_type: string;
    theme: "light" | "dark";
    grouping_field: "poll_id" | "electoral_district";
    name: string;
  };
};

export const loader: LoaderFunction = async () => {
  const settings = await getSettings();
  return json({ settings });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const theme = formData.get("theme");
  const grouping_field = formData.get("grouping_field");
  const name = formData.get("name");
  return updateMultipleSettings({ theme, grouping_field, name })
  .then(() => json({}, 200))
  .catch(error => {
    console.error(error)
    return json({error}, 500)
});

};

export default function Settings() {
  const { settings } = useLoaderData<LoaderData>();
  const nav = useNavigation();

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Settings</h1>
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
            className="w-full p-2 border rounded "
          />
        </div>
        <div>
          <label htmlFor="database_type" className="block mb-1">
            Database Type:
          </label>
          <input
            type="text"
            id="database_type"
            name="database_type"
            value={settings.database_type}
            readOnly
            disabled
            className="w-full p-2 border rounded bg-gray-100"
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
          </select>
        </div>

        <button
          type="submit"
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={nav.state === "submitting"}
        >
          {nav.state === "submitting" ? "Saving..." : "Save Settings"}
        </button>
      </Form>
    </div>
  );
}
