import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useSubmit,
  useNavigate,
  useSearchParams,
  Form,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { useFileChanges } from "~/hooks/useFileChanges";
import { Contact, createManyContacts, getContacts } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";
import { parseCSV, parseCSVData, parseCSVHeaders } from "~/utils/csvParser";
import { useContacts } from "~/utils/live-update";

type LoaderData = {
  contacts: Array<Contact>;
  total: number;
  page: number;
  limit: number;
  letterFilter: string;
  search: string;
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
      search: search,
    },
  });

  return json<LoaderData>({
    contacts,
    total,
    page,
    limit,
    letterFilter,
    search,
    userId,
  });
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

  const data = await request.json();
  await createManyContacts(data.contacts, userId);
  return json({ success: true });
};

export default function Contacts() {
  const {
    contacts: initialContacts,
    total,
    page,
    limit,
    letterFilter,
    search,
    userId,
  } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, setContacts, handleUpdate } = useContacts({
    initialContacts,
  });
  const [newContacts, setNewContacts] = useState([]);
  const { error } = useFileChanges(`ws://localhost:5173`, userId);
  const submit = useSubmit();
  const navigate = useNavigate();

  const totalPages = Math.ceil(total / limit);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
    setNewContacts([]);
  };

  const handlePageChange = (newPage: number) => {
    searchParams.set("page", newPage.toString());
    setSearchParams(searchParams);
  };

  const handleLetterFilter = (letter: string) => {
    searchParams.set("letter", letter);
    searchParams.delete("page");
    searchParams.delete("search");
    setSearchParams(searchParams);
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchTerm = formData.get("search") as string;
    searchParams.set("search", searchTerm);
    searchParams.delete("page");
    searchParams.delete("letter");
    setSearchParams(searchParams);
  };

  const clearFilters = () => {
    searchParams.delete("search");
    searchParams.delete("letter");
    searchParams.delete("page");
    setSearchParams(searchParams);
  };

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts, setContacts]);

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
                letterFilter === letter
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
      <Form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          name="search"
          placeholder="Search contacts..."
          defaultValue={search}
          className="border p-2 rounded mr-2"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Search
        </button>
      </Form>
      {(letterFilter || search) && (
        <button
          onClick={clearFilters}
          className="mb-4 px-2 py-1 rounded bg-red-500 text-white"
        >
          Clear All Filters
        </button>
      )}
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
              <span className="text-sm text-gray-500">{contact.email}</span>
              <span className="text-sm text-gray-500">{contact.phone}</span>
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
        <span>
          Page {page} of {totalPages}
        </span>
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
