import { useState } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useSubmit,
  useActionData,
  Form,
} from "@remix-run/react";
import {
  getCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField,
} from "~/models/settings";

type LoaderData = {
  canvassFields: CustomField[];
};

export const loader: LoaderFunction = async () => {
  const customFields = await getCustomFields("canvass");
  const interactionFields = await getCustomFields("interaction");
  return json<LoaderData>({
    canvassFields: [ ...customFields, ...interactionFields ],
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    switch (action) {
      case "addCustomField":
        await addCustomField({
          section: "canvass",
          field_name: formData.get("field_name") as string,
          field_type: formData.get("field_type") as string,
          options: formData.get("options")
            ? (formData.get("options") as string).split(",")
            : null,
          is_default: false,
        });
        break;
      case "updateCustomField":
        await updateCustomField(Number(formData.get("id")), {
          field_name: formData.get("field_name") as string,
          field_type: formData.get("field_type") as string,
          options: formData.get("options")
            ? (formData.get("options") as string).split(",")
            : null,
        });
        break;
      case "deleteCustomField":
        await deleteCustomField(Number(formData.get("id")));
        break;
    }
    return json({ success: true });
  } catch (error) {
    console.error("Error in action:", error);
    return json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
};

export default function CanvassFields() {
  const { canvassFields } = useLoaderData<LoaderData>();
  const actionData = useActionData();
  const submit = useSubmit();
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  const handleAddCustomField = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("action", "addCustomField");
    formData.append("field_name", newFieldName);
    formData.append("field_type", newFieldType);
    if (newFieldType === "select") {
      formData.append("options", newFieldOptions);
    }
    submit(formData, { method: "post" });
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldOptions("");
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

  return (
    <div>
      <h2 className="text-2xl mb-4">Canvass Fields</h2>
      {actionData?.error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {actionData.error}</span>
        </div>
      )}
      <div className="space-y-2">
        {canvassFields.map((field) => (
          <div key={field.id} className="p-2 border rounded flex items-center">
            <input
              type="text"
              value={field.field_name}
              onChange={(e) =>
                handleUpdateCustomField({
                  ...field,
                  field_name: e.target.value,
                })
              }
              className="flex-grow p-1 mr-2"
            />
            <select
              value={field.field_type}
              onChange={(e) =>
                handleUpdateCustomField({
                  ...field,
                  field_type: e.target.value,
                })
              }
              className="p-1 mr-2"
            >
              <option value="text">Text</option>
              <option value="select">Select</option>
              <option value="boolean">Boolean</option>
            </select>
            {field.field_type === "select" && (
              <input
                type="text"
                value={field.options?.join(",") || ""}
                onChange={(e) =>
                  handleUpdateCustomField({
                    ...field,
                    options: e.target.value.split(","),
                  })
                }
                placeholder="Options (comma-separated)"
                className="p-1 mr-2"
              />
            )}
            {!field.is_default && (
              <button
                onClick={() => handleDeleteCustomField(field.id)}
                className="p-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            )}
            {field.is_default && (
              <span className="text-sm text-gray-500">Default</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 p-2 border rounded">
        <h3 className="text-lg mb-2">Add New Field</h3>
        <Form
          method="post"
          onSubmit={handleAddCustomField}
          className="space-y-2"
        >
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Field Name"
            className="p-1 border rounded w-full"
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value)}
            className="p-1 border rounded w-full"
          >
            <option value="text">Text</option>
            <option value="select">Select</option>
            <option value="boolean">Boolean</option>
          </select>
          {newFieldType === "select" && (
            <input
              type="text"
              value={newFieldOptions}
              onChange={(e) => setNewFieldOptions(e.target.value)}
              placeholder="Options (comma-separated)"
              className="p-1 border rounded w-full"
            />
          )}
          <button
            type="submit"
            className="p-2 bg-green-500 text-white rounded w-full"
          >
            Add Field
          </button>
        </Form>
      </div>
    </div>
  );
}
