import { useCallback, useEffect, useRef, useState } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useFetcher,
} from "@remix-run/react";
import {
  getCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
} from "~/models/settings";

type ContactField = {
  id: string | number;
  field_name: string;
  field_type: string;
  db_column?: string;
  options?: string[];
};

type LoaderData = {
  contactFields: ContactField[];
};

const defaultContactFields: ContactField[] = [
  {
    id: "default-1",
    field_name: "First Name",
    field_type: "text",
    db_column: "firstname",
  },
  {
    id: "default-2",
    field_name: "Surname",
    field_type: "text",
    db_column: "surname",
  },
  {
    id: "default-3",
    field_name: "Email",
    field_type: "text",
    db_column: "email",
  },
  {
    id: "default-4",
    field_name: "Phone",
    field_type: "text",
    db_column: "phone",
  },
  {
    id: "default-5",
    field_name: "Unit",
    field_type: "text",
    db_column: "unit",
  },
  {
    id: "default-6",
    field_name: "Street Name",
    field_type: "text",
    db_column: "street_name",
  },
  {
    id: "default-7",
    field_name: "Street Number",
    field_type: "text",
    db_column: "street_number",
  },
  {
    id: "default-8",
    field_name: "Address",
    field_type: "text",
    db_column: "address",
  },
  {
    id: "default-9",
    field_name: "City",
    field_type: "text",
    db_column: "city",
  },
  {
    id: "default-10",
    field_name: "Postal Code",
    field_type: "text",
    db_column: "postal",
  },
  {
    id: "default-11",
    field_name: "Electoral District",
    field_type: "text",
    db_column: "electoral_district",
  },
  {
    id: "default-12",
    field_name: "Poll ID",
    field_type: "text",
    db_column: "poll_id",
  },
];

export const loader: LoaderFunction = async () => {
  const customFields = await getCustomFields("contacts");
  return json<LoaderData>({
    contactFields: [...defaultContactFields, ...customFields],
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");
  console.log(action);
  try {
    switch (action) {
      case "addCustomField":
        await addCustomField({
          section: "contacts",
          field_name: formData.get("field_name") as string,
          field_type: formData.get("field_type") as string,
          options: formData.get("options")
            ? (formData.get("options") as string).split(",")
            : null,
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

export default function ContactsFields() {
    const { contactFields: initialContactFields } = useLoaderData<LoaderData>();
    const [contactFields, setContactFields] = useState(initialContactFields);
    const actionData = useActionData();
    const fetcher = useFetcher();
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldType, setNewFieldType] = useState("text");
    const [newFieldOptions, setNewFieldOptions] = useState("");
  
    const debouncedSubmitRef = useRef<NodeJS.Timeout | null>(null);
  
    useEffect(() => {
      return () => {
        if (debouncedSubmitRef.current) {
          clearTimeout(debouncedSubmitRef.current);
        }
      };
    }, []);
  
    useEffect(() => {
      if (fetcher.data?.success) {
        if (fetcher.data.newField) {
          setContactFields(prev => [...prev, fetcher.data.newField]);
        }
        fetcher.data = null;
      }
    }, [fetcher, fetcher.data]);
  
    const handleUpdateCustomField = useCallback((updatedField: ContactField) => {
      setContactFields(prevFields => 
        prevFields.map(field => 
          field.id === updatedField.id ? updatedField : field
        )
      );
  
      if (debouncedSubmitRef.current) {
        clearTimeout(debouncedSubmitRef.current);
      }
  
      debouncedSubmitRef.current = setTimeout(() => {
        const formData = new FormData();
        formData.append("action", "updateCustomField");
        Object.entries(updatedField).forEach(([key, value]) => {
          formData.append(key, value?.toString() || "");
        });
        fetcher.submit(formData, { method: "post" });
      }, 500);
    }, [fetcher]);
  
    const handleAddCustomField = useCallback((e: React.FormEvent) => {
      e.preventDefault();
      const newField: ContactField = {
        id: Date.now(), // Temporary ID
        field_name: newFieldName,
        field_type: newFieldType,
        options: newFieldType === "select" ? newFieldOptions.split(",") : undefined,
      };
      setContactFields(prev => [...prev, newField]);
  
      const formData = new FormData();
      formData.append("action", "addCustomField");
      formData.append("field_name", newFieldName);
      formData.append("field_type", newFieldType);
      if (newFieldType === "select") {
        formData.append("options", newFieldOptions);
      }
      fetcher.submit(formData, { method: "post" });
  
      setNewFieldName("");
      setNewFieldType("text");
      setNewFieldOptions("");
    }, [newFieldName, newFieldType, newFieldOptions, fetcher]);
  
    const handleDeleteCustomField = useCallback((id: number) => {
      if (confirm("Are you sure you want to delete this field?")) {
        setContactFields(prev => prev.filter(field => field.id !== id));
  
        const formData = new FormData();
        formData.append("action", "deleteCustomField");
        formData.append("id", id.toString());
        fetcher.submit(formData, { method: "post" });
      }
    }, [fetcher]);
  
    return (
      <div>
        <h2 className="text-2xl mb-4">Contact Fields</h2>
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
          {contactFields.map((field) => (
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
                disabled={
                  typeof field.id === "string" && field.id.startsWith("default")
                }
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
                disabled={
                  typeof field.id === "string" && field.id.startsWith("default")
                }
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
                  disabled={
                    typeof field.id === "string" && field.id.startsWith("default")
                  }
                />
              )}
              {typeof field.id === "number" && (
                <button
                  onClick={() => handleDeleteCustomField(field.id as number)}
                  className="p-1 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 p-2 border rounded">
          <h3 className="text-lg mb-2">Add New Custom Field</h3>
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
  
