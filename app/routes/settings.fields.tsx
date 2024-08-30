import { useState } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useSubmit, useActionData } from "@remix-run/react";
import {
  getCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField
} from "~/models/settings";

type LoaderData = {
  customFields: CustomField[];
};

const defaultContactFields = [
  { field_name: 'First Name', field_type: 'text', db_column: 'firstname' },
  { field_name: 'Surname', field_type: 'text', db_column: 'surname' },
  { field_name: 'Email', field_type: 'text', db_column: 'email' },
  { field_name: 'Phone', field_type: 'text', db_column: 'phone' },
  { field_name: 'Unit', field_type: 'text', db_column: 'unit' },
  { field_name: 'Street Name', field_type: 'text', db_column: 'street_name' },
  { field_name: 'Street Number', field_type: 'text', db_column: 'street_number' },
  { field_name: 'Address', field_type: 'text', db_column: 'address' },
  { field_name: 'City', field_type: 'text', db_column: 'city' },
  { field_name: 'Postal Code', field_type: 'text', db_column: 'postal' },
  { field_name: 'Electoral District', field_type: 'text', db_column: 'electoral_district' },
  { field_name: 'Poll ID', field_type: 'text', db_column: 'poll_id' },
  { field_name: 'Voted', field_type: 'boolean', db_column: 'voted' },
  { field_name: 'Ride Status', field_type: 'text', db_column: 'ride_status' },
];

export const loader: LoaderFunction = async () => {
  try {
    const customFields = await getCustomFields();
    return json({ customFields });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ customFields: [], error: "Failed to load custom fields" }, { status: 500 });
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    switch (action) {
      case "addCustomField":
        await addCustomField({
          section: formData.get("section") as string,
          field_name: formData.get("field_name") as string,
          field_type: formData.get("field_type") as string,
          options: formData.get("options") ? (formData.get("options") as string).split(',') : null
        });
        break;
      case "updateCustomField":
        await updateCustomField(Number(formData.get("id")), {
          field_name: formData.get("field_name") as string,
          field_type: formData.get("field_type") as string,
          options: formData.get("options") ? (formData.get("options") as string).split(',') : null
        });
        break;
      case "deleteCustomField":
        await deleteCustomField(Number(formData.get("id")));
        break;
    }
    return json({ success: true });
  } catch (error) {
    console.error("Error in action:", error);
    return json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
};

export default function FieldsSettings() {
  const { customFields, error } = useLoaderData<LoaderData>();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [activeSection, setActiveSection] = useState("contacts");
  const sections = ["contacts", "canvass", "dispatch", "scrutineer", "interactions"];

  const handleAddCustomField = () => {
    const formData = new FormData();
    formData.append("action", "addCustomField");
    formData.append("section", activeSection);
    formData.append("field_name", "New Field");
    formData.append("field_type", "text");
    submit(formData, { method: "post" });
  };

  const handleUpdateCustomField = (field: CustomField) => {
    const formData = new FormData();
    formData.append("action", "updateCustomField");
    Object.entries(field).forEach(([key, value]) => {
      formData.append(key, value?.toString() || "");
    });
    submit(formData, { method: "post" });
  };

  const handleDeleteCustomField = (id: number) => {
    if (confirm("Are you sure you want to delete this field?")) {
      const formData = new FormData();
      formData.append("action", "deleteCustomField");
      formData.append("id", id.toString());
      submit(formData, { method: "post" });
    }
  };

  const renderFields = () => {
    if (activeSection === "contacts") {
      return defaultContactFields.map((field) => (
        <div key={field.db_column} className="mb-2 p-2 border rounded flex items-center">
          <input
            type="text"
            value={field.field_name}
            className="p-1 border rounded mr-2 flex-grow"
            disabled
          />
          <select
            value={field.field_type}
            className="p-1 border rounded mr-2"
            disabled
          >
            <option value="text">Text</option>
            <option value="select">Select</option>
            <option value="boolean">Boolean</option>
          </select>
        </div>
      ));
    } else {
      return customFields.filter(field => field.section === activeSection).map((field) => (
        <div key={field.id} className="mb-2 p-2 border rounded flex items-center">
          <input
            type="text"
            value={field.field_name}
            onChange={(e) => handleUpdateCustomField({ ...field, field_name: e.target.value })}
            className="p-1 border rounded mr-2 flex-grow"
          />
          <select
            value={field.field_type}
            onChange={(e) => handleUpdateCustomField({ ...field, field_type: e.target.value })}
            className="p-1 border rounded mr-2"
          >
            <option value="text">Text</option>
            <option value="select">Select</option>
            <option value="boolean">Boolean</option>
          </select>
          {field.field_type === "select" && (
            <input
              type="text"
              value={field.options?.join(",") || ""}
              onChange={(e) => handleUpdateCustomField({ ...field, options: e.target.value.split(",") })}
              placeholder="Options (comma-separated)"
              className="p-1 border rounded mr-2 flex-grow"
            />
          )}
          <button
            onClick={() => handleDeleteCustomField(field.id)}
            className="p-1 bg-red-500 text-white rounded"
          >
            Delete
          </button>
        </div>
      ));
    }
  };

  return (
    <div>
      <h2 className="text-2xl mb-4">Fields Settings</h2>
      {(error || actionData?.error) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error || actionData.error}</span>
        </div>
      )}
      <div className="flex space-x-4 mb-4">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`p-2 rounded ${
              activeSection === section ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>
      <div>
        <h3 className="text-xl mb-2 capitalize">{activeSection} Fields</h3>
        {renderFields()}
        {activeSection !== 'contacts' && (
          <button
            onClick={handleAddCustomField}
            className="p-2 bg-green-500 text-white rounded mt-2"
          >
            Add Field
          </button>
        )}
      </div>
    </div>
  );
}