import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, Form } from "@remix-run/react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { getContactById, updateContact, deleteContact, Contact } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";

export const loader: LoaderFunction = async ({ params }) => {
  const contact = await getContactById(Number(params.id));
  if (!contact) {
    throw new Response("Not Found", { status: 404 });
  }
  return json({ contact });
};

export const action: ActionFunction = async ({ request, params }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/login");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteContact(Number(params.id));
    return redirect("/contacts");
  }

  if (intent === "update") {
    const updatedContact: Partial<Contact> = {};
    formData.forEach((value, key) => {
      if (key !== "intent") {  // Exclude the 'intent' field
        if (key === "voted") {
          updatedContact[key] = value === "on";
        } else if (key === "created_at" || key === "updated_at") {
          updatedContact[key] = new Date(value as string);
        } else {
          updatedContact[key] = value as string;
        }
      }
    });
    
    // Filter out any keys that are not in the Contact model
    const validKeys = [
      'firstname', 'surname', 'email', 'unit', 'street_name', 'street_number',
      'address', 'city', 'postal', 'phone', 'external_id', 'electoral_district',
      'poll_id', 'last_contacted', 'last_contacted_by', 'ride_status', 'voted'
    ];
    const filteredContact = Object.fromEntries(
      Object.entries(updatedContact).filter(([key]) => validKeys.includes(key))
    );

    await updateContact(Number(params.id), filteredContact as Partial<Contact>, userId);
    return redirect(`/contacts/${params.id}`);
  }

  return null;
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString();
};

export default function ContactDetail() {
  const { contact } = useLoaderData<{ contact: Contact }>();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const fieldGroups = [
    {
      title: "Personal Information",
      fields: ["firstname", "surname", "email", "phone"]
    },
    {
      title: "Address",
      fields: ["unit", "street_number", "street_name", "address", "city", "postal"]
    },
    {
      title: "Electoral Information",
      fields: ["external_id", "electoral_district", "poll_id"]
    },
    {
      title: "Status",
      fields: ["last_contacted", "last_contacted_by", "ride_status", "voted"]
    },
    {
      title: "System Information",
      fields: ["created_at", "created_by", "updated_at", "updated_by"]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Contact Details</h1>
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <button
                  type="submit"
                  form="contact-form"
                  name="intent"
                  value="update"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <Form id="contact-form" method="post" className="p-6">
          {fieldGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <h2 className="text-xl font-semibold mb-3">{group.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div key={field} className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')}
                    </label>
                    {isEditing ? (
                      field === "voted" ? (
                        <input
                          type="checkbox"
                          name={field}
                          defaultChecked={contact[field] as boolean}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      ) : ["created_at", "updated_at"].includes(field) ? (
                        <input
                          type="datetime-local"
                          name={field}
                          defaultValue={new Date(contact[field] as Date).toISOString().slice(0, 16)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          disabled
                        />
                      ) : (
                        <input
                          type="text"
                          name={field}
                          defaultValue={contact[field]?.toString() ?? ""}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                      )
                    ) : (
                      <p className="text-sm text-gray-900">
                        {field === "voted"
                          ? contact[field] ? "Yes" : "No"
                          : ["created_at", "updated_at"].includes(field)
                          ? formatDate(contact[field] as Date)
                          : contact[field]?.toString() || "N/A"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/contacts")}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Back to Contacts
            </button>
            <button
              type="submit"
              name="intent"
              value="delete"
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
              onClick={(e) => {
                if (!confirm("Are you sure you want to delete this contact?")) {
                  e.preventDefault();
                }
              }}
            >
              Delete Contact
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}