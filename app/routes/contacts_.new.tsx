import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useNavigation,
  useNavigate,
  useLoaderData,
} from "@remix-run/react";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { createContact } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";
import { getCustomFields } from "~/models/settings";

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/login");

  const formData = await request.formData();
  const newContact = Object.fromEntries(formData);

  try {
    await createContact(newContact, userId);
    return redirect("/contacts");
  } catch (error) {
    return json({ error: "Failed to create contact" }, { status: 400 });
  }
};

export const loader: LoaderFunction = async ({ request }) => {
  const customFields = await getCustomFields("contacts");
  return { customFields };
};

export default function NewContact() {
  const { customFields } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  const validateForm = (formData: FormData) => {
    const newErrors = {};
    if (!formData.get("firstname"))
      newErrors.firstname = "First name is required";
    if (!formData.get("surname")) newErrors.surname = "Last name is required";
    if (!formData.get("email")) newErrors.email = "Email is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (!validateForm(new FormData(form))) {
      event.preventDefault();
    }
  };
  const fieldGroups = [
    {
      title: "Personal Information",
      fields: ["firstname", "surname", "email", "phone"],
    },
    {
      title: "Address",
      fields: [
        "unit",
        "street_number",
        "street_name",
        "address",
        "city",
        "postal",
      ],
    },
    {
      title: "Electoral Information",
      fields: ["external_id", "electoral_district", "poll_id"],
    },
    {
      title: "Status",
      fields: ["last_contacted", "last_contacted_by", "ride_status", "voted"],
    },
    {
        title: "Custom Fields",
        fields: customFields.reduce((acc, curr) => [...acc, curr.field_name],[])
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-screen">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">New Contact</h1>
        </div>
        <Form
          id="contact-form"
          method="post"
          onSubmit={handleSubmit}
          className="p-6"
        >
          {fieldGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <h2 className="text-xl font-semibold mb-3">{group.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div key={field} className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.charAt(0).toUpperCase() +
                        field.slice(1).replace("_", " ")}
                    </label>
                    {field === "voted" ? (
                      <input
                        type="checkbox"
                        name={field}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    ) : (
                      <input
                        type="text"
                        name={field}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                    )}
                    {errors[field] && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors[field]}
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
              onClick={() => navigate(-1)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              {navigation.state === "submitting"
                ? "Creating..."
                : "Create Contact"}
            </button>
          </div>
        </Form>
      </div>
      {actionData?.error && (
        <p className="mt-4 text-red-500">{actionData.error}</p>
      )}
    </div>
  );
}
