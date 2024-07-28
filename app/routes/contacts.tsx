import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSubmit, redirect } from "@remix-run/react";
import { useState } from "react";
import { Contact, createManyContacts, getContacts } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";


type LoaderData = {
  contacts: Array<Contact>;
};

export const loader: LoaderFunction = async () => {
  const contacts = await getContacts();
  return json({ contacts });
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/login");
  const data = await request.json();

  await createManyContacts(data.contacts, userId);
  return json({ success: true });
};

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\n' || char === '\r') {
        row.push(currentValue.trim());
        currentValue = '';
        if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          result.push(row);
          row = [];
          if (char === '\r') i++;
        }
      } else {
        currentValue += char;
      }
    }
  }

  if (currentValue) {
    row.push(currentValue.trim());
  }
  if (row.length > 0) {
    result.push(row);
  }

  return result;
}

function parseCSVHeaders(headers: string[]): string[] {
  return headers.map((header) => header.toLowerCase().replace(/\s+/g, "_"));
}

function parseCSVData(records: string[][], headers: string[]): Contact[] {
  return records.slice(1).map((record) => {
    const contact: Partial<Contact> = {};
    headers.forEach((header, index) => {
      if (record[index]) {
        contact[header as keyof Contact] = record[index];
      }
    });
    return contact as Contact;
  });
}

export default function Contacts() {
  const { contacts } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const [newContacts, setNewContacts] = useState<Contact[]>([]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "text/csv") {
        readCSVFile(file);
      } else {
        console.error(`File type ${file.type} unsupported.`);
      }
    }
    e.target.value = "";
  };

  const readCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const records = parseCSV(text);
      const parsedHeaders =
        records.length > 0 ? parseCSVHeaders(records[0]) : [];
      const newData = parseCSVData(records, parsedHeaders);
      setNewContacts(newData);
    };
    reader.readAsText(file);
  };

  const submitContacts = () => {
    submit(
      { contacts: newContacts },
      {
        method: "POST",
        action: "/contacts",
        encType: "application/json",
        navigate: false,
      }
    );
  };

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Contacts</h1>
      <div className="flex space-x-4 mb-4">
        <Link
          to="/contacts/new"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add New Contact
        </Link>
        <label className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 cursor-pointer">
          Import CSV
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".csv"
          />
        </label>
        {newContacts.length > 0 && (
          <button
            onClick={submitContacts}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Submit Imported Contacts
          </button>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {contacts.map((contact) => (
          <li key={contact.id} className="border p-2 rounded flex flex-col">
            <Link
              to={`/contacts/${contact.id}`}
              className="text-blue-600 hover:underline"
            >
              {contact.firstname} {contact.surname}
            </Link>
            <span className="flex gap-2">
              <span className="text-sm text-gray-500">
                {contact.email}
              </span>
              <span className="text-sm text-gray-500">
                {contact.phone}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
