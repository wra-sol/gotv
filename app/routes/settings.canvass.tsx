import { useEffect, useState } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useSubmit,
  useActionData,
  Form,
  useNavigation,
  useFetcher,
} from "@remix-run/react";
import {
  getCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField,
} from "~/models/settings";
import {
  addRuleToCanvassList,
  createCanvassList,
  deleteCanvassList,
  deleteRuleFromCanvassList,
  getCanvassLists,
  getRulesForCanvassList,
  updateCanvassList,
} from "~/models/canvass-lists.server";

type LoaderData = {
  canvassFields: CustomField[];
  canvassLists: CanvassList[];
};

export interface CanvassList {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  created_by: number;
  updated_at: Date;
  updated_by: number;
}

export interface CanvassListRule {
  id: number;
  canvass_list_id: number;
  field_name: string;
  operator: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}
export const loader: LoaderFunction = async () => {
  const customFields = await getCustomFields("canvass");
  const interactionFields = await getCustomFields("interaction");
  const canvassLists = await getCanvassLists();
  return json<LoaderData>({
    canvassFields: [...customFields, ...interactionFields, ],
    canvassLists,
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
      case "createCanvassList":
        console.log(Object.entries(formData))
        await createCanvassList(
          formData.get("name") as string,
          formData.get("description") as string,
          Number(formData.get("userId"))
        );
        break;
      case "updateCanvassList":
        await updateCanvassList(
          Number(formData.get("id")),
          {
            name: formData.get("name") as string,
            description: formData.get("description") as string,
          },
          Number(formData.get("userId"))
        );
        break;
      case "deleteCanvassList":
        await deleteCanvassList(Number(formData.get("id")));
        break;
      case "addRuleToCanvassList":
        await addRuleToCanvassList(
          Number(formData.get("canvassListId")),
          formData.get("fieldName") as string,
          formData.get("operator") as string,
          formData.get("value") as string
        );
        break;
      case "deleteRuleFromCanvassList":
        await deleteRuleFromCanvassList(Number(formData.get("ruleId")));
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
  const { canvassFields, canvassLists } = useLoaderData<LoaderData>();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const fetcher = useFetcher();
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [selectedList, setSelectedList] = useState<CanvassList | null>(null);
  const [listRules, setListRules] = useState<CanvassListRule[]>([]);

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
  const handleCreateCanvassList = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("action", "createCanvassList");
    formData.append("name", newListName);
    formData.append("description", newListDescription);
    formData.append("userId", "1"); 
    submit(formData, { method: "post" });
    setNewListName("");
    setNewListDescription("");
  };

  const handleUpdateCanvassList = (list: CanvassList) => {
    const formData = new FormData();
    formData.append("action", "updateCanvassList");
    formData.append("id", list.id.toString());
    formData.append("name", list.name);
    formData.append("description", list.description || "");
    formData.append("userId", "1"); // Replace with actual user ID
    submit(formData, { method: "post" });
  };

  const handleDeleteCanvassList = (id: number) => {
    if (confirm("Are you sure you want to delete this list?")) {
      const formData = new FormData();
      formData.append("action", "deleteCanvassList");
      formData.append("id", id.toString());
      submit(formData, { method: "post" });
    }
  };

  const handleAddRuleToCanvassList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList) return;
    const formData = new FormData(e.target as HTMLFormElement);
    formData.append("action", "addRuleToCanvassList");
    formData.append("canvassListId", selectedList.id.toString());
    submit(formData, { method: "post" });
  };

  const handleDeleteRuleFromCanvassList = (ruleId: number) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      const formData = new FormData();
      formData.append("action", "deleteRuleFromCanvassList");
      formData.append("ruleId", ruleId.toString());
      submit(formData, { method: "post" });
    }
  };
  const handleSelectList = (list: CanvassList) => {
    setSelectedList(list);
    fetcher.submit(
      { action: "getRules", listId: list.id.toString() },
      { method: "post" }
    );
  };
  
  useEffect(() => {
    if (fetcher.data?.rules) {
      setListRules(fetcher.data.rules);
    }
  }, [fetcher.data]);
  
    
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
      <section className="mb-8" id="Custom-Field">
        <div className="space-y-2">
          <h3 className="text-xl mb-2">Custom Fields</h3>
          {canvassFields.map((field) => (
            <div
              key={field.id}
              className="p-2 border rounded flex items-center"
            >
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
      </section>
      <section className="mb-8" id="Custom-Lists">
        <h3 className="text-xl mb-2">Canvass Lists</h3>
        <div className="space-y-2">
          {canvassLists?.map((list) => (
            <div key={list.id} className="p-2 border rounded flex items-center">
              <input
                type="text"
                value={list.name}
                onChange={(e) => handleUpdateCanvassList({ ...list, name: e.target.value })}
                className="flex-grow p-1 mr-2"
              />
              <button
                onClick={() => handleSelectList(list)}
                className="p-1 bg-blue-500 text-white rounded mr-2"
              >
                Edit Rules
              </button>

              <button
                onClick={() => handleDeleteCanvassList(list.id)}
                className="p-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 p-2 border rounded">
          <h4 className="text-lg mb-2">Create New List</h4>
          <Form method="post" onSubmit={handleCreateCanvassList} className="space-y-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List Name"
              className="p-1 border rounded w-full"
            />
            <textarea
              value={newListDescription}
              onChange={(e) => setNewListDescription(e.target.value)}
              placeholder="Description"
              className="p-1 border rounded w-full"
            />
            <button
              type="submit"
              className="p-2 bg-green-500 text-white rounded w-full"
              disabled={nav.state === "submitting"}
            >
              {nav.state === "submitting" ? "Creating..." : "Create List"}
            </button>
          </Form>
        </div>
      </section>
      {selectedList && (
        <section className="mb-8">
          <h3 className="text-xl mb-2">Rules for {selectedList.name}</h3>
          <div className="space-y-2">
            {listRules.map((rule) => (
              <div key={rule.id} className="p-2 border rounded flex items-center">
                <span className="flex-grow">
                  {rule.field_name} {rule.operator} {rule.value}
                </span>
                <button
                  onClick={() => handleDeleteRuleFromCanvassList(rule.id)}
                  className="p-1 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <Form method="post" onSubmit={handleAddRuleToCanvassList} className="mt-4 space-y-2">
            <select name="fieldName" className="p-1 border rounded w-full">
              {canvassFields.map((field) => (
                <option key={field.id} value={field.field_name}>
                  {field.field_name}
                </option>
              ))}
            </select>
            <select name="operator" className="p-1 border rounded w-full">
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="startsWith">Starts With</option>
              <option value="endsWith">Ends With</option>
            </select>
            <input
              type="text"
              name="value"
              placeholder="Value"
              className="p-1 border rounded w-full"
            />
            <button
              type="submit"
              className="p-2 bg-blue-500 text-white rounded w-full"
              disabled={nav.state === "submitting"}
            >
              {nav.state === "submitting" ? "Adding..." : "Add Rule"}
            </button>
          </Form>
        </section>
      )}
    </div>
  );
}
