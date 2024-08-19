import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSubmit, useNavigate, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import { useFileChanges } from "~/hooks/useFileChanges";
import { Contact, createManyContacts, getContacts } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";
import { useContacts } from "~/utils/live-update";

type LoaderData = {
  contacts: Array<Contact>;
  total: number;
  page: number;
  limit: number;
  letterFilter: string;
  userId: string;
};
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const userId = await getUserId(request);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const letterFilter = url.searchParams.get("letter") || "";
  const search = url.searchParams.get("search") || "";

  const offset = (page - 1) * limit;
  const { contacts, total } = await getContacts({ 
    offset, 
    limit, 
    filters: { 
      lastNameStartsWith: letterFilter,
      search: search
    } 
  });

  return json({ contacts, total, page, limit, letterFilter, search, userId });
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

  const data = await request.json();
  await createManyContacts(data.contacts, userId);
  return json({ success: true });
};

// CSV parsing functions remain the same
function parseCSV(text: string): string[][] { /* ... */ }
function parseCSVHeaders(headers: string[]): string[] { /* ... */ }
function parseCSVData(records: string[][], headers: string[]): Contact[] { /* ... */ }

export default function Contacts() {
  const { contacts:initialContacts, total, page, limit, letterFilter, userId } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const [newContacts, setNewContacts] = useState<Contact[]>([]);
  const {contacts, handleUpdate} = useContacts({initialContacts}); 
    const { error } = useFileChanges(`ws://localhost:5173?sessionId=${userId}`, handleUpdate);


  const totalPages = Math.ceil(total / limit);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
        encType: "application/json",
        navigate: false,
      }
    );
  };

  const handlePageChange = (newPage: number) => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("page", newPage.toString());
    navigate(`?${searchParams.toString()}`);
  };

  const handleLetterFilter = (letter: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("letter", letter);
    searchParams.set("page", "1");
    navigate(`?${searchParams.toString()}`);
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
            Submit Imported Contacts ({newContacts.length})
          </button>
        )}
      </div>
      <div className="mb-4">
        <h2 className="text-xl mb-2">Filter by Last Name</h2>
        <div className="flex flex-wrap gap-2">
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => handleLetterFilter(letter)}
              className={`px-2 py-1 rounded ${
                letterFilter === letter ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {letter}
            </button>
          ))}
          {letterFilter && (
            <button
              onClick={() => handleLetterFilter('')}
              className="px-2 py-1 rounded bg-red-500 text-white"
            >
              Clear Filter
            </button>
          )}
        </div>
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
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}