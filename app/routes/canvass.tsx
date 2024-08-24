import { useState, useEffect } from "react";
import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSubmit, Form, useNavigate, Link } from "@remix-run/react";
import { getContacts, updateContact, Contact, getUniqueGroupingValues } from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";

type LoaderData = {
  contacts: Contact[];
  total: number;
  electoralDistricts: string[];
  pollIds: string[];
};

type Filters = {
  search: string;
  supportLevel: string;
  wantsSign: string;
  willVolunteer: string;
  planToVote: string;
  electoralDistrict: string;
  pollId: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const filters: Filters = {
    search: url.searchParams.get("search") || "",
    supportLevel: url.searchParams.get("supportLevel") || "",
    wantsSign: url.searchParams.get("wantsSign") || "",
    willVolunteer: url.searchParams.get("willVolunteer") || "",
    planToVote: url.searchParams.get("planToVote") || "",
    electoralDistrict: url.searchParams.get("electoralDistrict") || "",
    pollId: url.searchParams.get("pollId") || "",
  };

  const offset = (page - 1) * limit;
  const { contacts, total } = await getContacts({ offset, limit, filters });
  const electoralDistricts = await getUniqueGroupingValues("electoral_district");
  const pollIds = await getUniqueGroupingValues("poll_id");

  return json({ contacts, total, electoralDistricts, pollIds });
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "updateCanvassInfo":
      const contactId = Number(formData.get("contactId"));
      const updates: Partial<Contact> = {
        support_level: formData.get("supportLevel") as string,
        wants_sign: formData.get("wantsSign") === "true",
        will_volunteer: formData.get("willVolunteer") === "true",
        plan_to_vote: formData.get("planToVote") as string,
        notes: formData.get("notes") as string,
      };
      await updateContact(contactId, updates, userId);
      break;
  }

  return json({ success: true });
};

export default function Canvass() {
  const { contacts, total, electoralDistricts, pollIds } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    supportLevel: "",
    wantsSign: "",
    willVolunteer: "",
    planToVote: "",
    electoralDistrict: "",
    pollId: "",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    const url = new URL(window.location.href);
    setFilters({
      search: url.searchParams.get("search") || "",
      supportLevel: url.searchParams.get("supportLevel") || "",
      wantsSign: url.searchParams.get("wantsSign") || "",
      willVolunteer: url.searchParams.get("willVolunteer") || "",
      planToVote: url.searchParams.get("planToVote") || "",
      electoralDistrict: url.searchParams.get("electoralDistrict") || "",
      pollId: url.searchParams.get("pollId") || "",
    });
    setPage(parseInt(url.searchParams.get("page") || "1"));
    setLimit(parseInt(url.searchParams.get("limit") || "10"));
  }, []);

  const handleFilterChange = (name: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setPage(1);
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    searchParams.append("page", "1");
    searchParams.append("limit", limit.toString());
    navigate(`?${searchParams.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("page", newPage.toString());
    navigate(`?${searchParams.toString()}`);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("limit", newLimit.toString());
    searchParams.set("page", "1");
    navigate(`?${searchParams.toString()}`);
  };

  const handleCanvassInfoUpdate = (contactId: number, updates: Partial<Contact>) => {
    const formData = new FormData();
    formData.append("action", "updateCanvassInfo");
    formData.append("contactId", contactId.toString());
    Object.entries(updates).forEach(([key, value]) => {
      formData.append(key, value?.toString() || "");
    });
    submit(formData, { method: "post" });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Canvass</h1>
      <div className="mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Add filter inputs similar to the Dispatch component */}
        {/* ... */}
        <button onClick={applyFilters} className="bg-blue-500 text-white px-4 py-2 rounded">
          Apply Filters
        </button>
      </div>
      <div className="mb-4">
        <select
          value={limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="p-2 border rounded"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Address</th>
            <th className="p-2 text-left">Support Level</th>
            <th className="p-2 text-left">Wants Sign</th>
            <th className="p-2 text-left">Will Volunteer</th>
            <th className="p-2 text-left">Plan to Vote</th>
            <th className="p-2 text-left">Notes</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b">
              <td className="p-2">{`${contact.firstname} ${contact.surname}`}</td>
              <td className="p-2">{contact.phone}</td>
              <td className="p-2">{`${contact.address}, ${contact.city}`}</td>
              <td className="p-2">
                <select
                  value={contact.support_level || ""}
                  onChange={(e) => handleCanvassInfoUpdate(contact.id, { support_level: e.target.value })}
                  className="p-1 border rounded"
                >
                  <option value="">Select</option>
                  <option value="strong">Strong</option>
                  <option value="lean">Lean</option>
                  <option value="undecided">Undecided</option>
                  <option value="opposed">Opposed</option>
                </select>
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={contact.wants_sign || false}
                  onChange={(e) => handleCanvassInfoUpdate(contact.id, { wants_sign: e.target.checked })}
                />
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={contact.will_volunteer || false}
                  onChange={(e) => handleCanvassInfoUpdate(contact.id, { will_volunteer: e.target.checked })}
                />
              </td>
              <td className="p-2">
                <select
                  value={contact.plan_to_vote || ""}
                  onChange={(e) => handleCanvassInfoUpdate(contact.id, { plan_to_vote: e.target.value })}
                  className="p-1 border rounded"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="undecided">Undecided</option>
                </select>
              </td>
              <td className="p-2">
                <input
                  type="text"
                  value={contact.notes || ""}
                  onChange={(e) => handleCanvassInfoUpdate(contact.id, { notes: e.target.value })}
                  className="p-1 border rounded w-full"
                />
              </td>
              <td className="p-2">
                <Link to={`/contacts/${contact.id}`} className="text-blue-500 hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center">
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