import { useState, useEffect } from "react";
import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSubmit, Form, useNavigate } from "@remix-run/react";
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
  rideStatus: string;
  voted: string;
  electoralDistrict: string;
  pollId: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const sortKey = url.searchParams.get("sortKey") || "id";
  const sortDirection = url.searchParams.get("sortDirection") || "asc";

  const filters: Filters = {
    search: url.searchParams.get("search") || "",
    rideStatus: url.searchParams.get("rideStatus") || "",
    voted: url.searchParams.get("voted") || "",
    electoralDistrict: url.searchParams.get("electoralDistrict") || "",
    pollId: url.searchParams.get("pollId") || "",
  };

  const offset = (page - 1) * limit;
  const { contacts, total } = await getContacts({ offset, limit, filters, sortKey, sortDirection });
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
    case "updateRideStatus":
      const contactId = Number(formData.get("contactId"));
      const rideStatus = formData.get("rideStatus") as string;
      await updateContact(contactId, { ride_status: rideStatus }, userId);
      break;
    case "updateVotedStatus":
      const votedContactId = Number(formData.get("contactId"));
      const voted = formData.get("voted") === "true";
      await updateContact(votedContactId, { voted }, userId);
      break;
    case "bulkUpdate":
      const selectedIds = formData.getAll("selectedIds[]").map(Number);
      const bulkRideStatus = formData.get("bulkRideStatus") as string;
      const bulkVoted = formData.get("bulkVoted") as string;
      for (const id of selectedIds) {
        const updates: Partial<Contact> = {};
        if (bulkRideStatus) updates.ride_status = bulkRideStatus;
        if (bulkVoted) updates.voted = bulkVoted === "true";
        await updateContact(id, updates, userId);
      }
      break;
  }

  return json({ success: true });
};

export default function Dispatch() {
  const { contacts, total, electoralDistricts, pollIds } = useLoaderData<LoaderData>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    rideStatus: "",
    voted: "",
    electoralDistrict: "",
    pollId: "",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    const url = new URL(window.location.href);
    setFilters({
      search: url.searchParams.get("search") || "",
      rideStatus: url.searchParams.get("rideStatus") || "",
      voted: url.searchParams.get("voted") || "",
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

  const handleRideStatusChange = (contactId: number, rideStatus: string) => {
    submit(
      { action: "updateRideStatus", contactId, rideStatus },
      { method: "post" }
    );
  };

  const handleVotedStatusChange = (contactId: number, voted: boolean) => {
    submit(
      { action: "updateVotedStatus", contactId, voted: voted.toString() },
      { method: "post" }
    );
  };

  const handleBulkUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("action", "bulkUpdate");
    selectedContacts.forEach(id => formData.append("selectedIds[]", id.toString()));
    submit(formData, { method: "post" });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dispatch</h1>
      <div className="mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <input
          type="text"
          placeholder="Search..."
          className="p-2 border rounded"
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
        />
        <select
          value={filters.rideStatus}
          onChange={(e) => handleFilterChange("rideStatus", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Ride Statuses</option>
          <option value="needs_ride">Needs Ride</option>
          <option value="ride_assigned">Ride Assigned</option>
          <option value="picked_up">Picked Up</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filters.voted}
          onChange={(e) => handleFilterChange("voted", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Voted Statuses</option>
          <option value="true">Voted</option>
          <option value="false">Not Voted</option>
        </select>
        <select
          value={filters.electoralDistrict}
          onChange={(e) => handleFilterChange("electoralDistrict", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Electoral Districts</option>
          {electoralDistricts.map(district => (
            <option key={district} value={district}>{district}</option>
          ))}
        </select>
        <select
          value={filters.pollId}
          onChange={(e) => handleFilterChange("pollId", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Poll IDs</option>
          {pollIds.map(pollId => (
            <option key={pollId} value={pollId}>{pollId}</option>
          ))}
        </select>
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
      <Form onSubmit={handleBulkUpdate}>
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts(contacts.map(c => c.id));
                    } else {
                      setSelectedContacts([]);
                    }
                  }}
                />
              </th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Electoral District</th>
              <th className="p-2 text-left">Poll ID</th>
              <th className="p-2 text-left">Ride Status</th>
              <th className="p-2 text-left">Voted</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([...selectedContacts, contact.id]);
                      } else {
                        setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                      }
                    }}
                  />
                </td>
                <td className="p-2">{`${contact.firstname} ${contact.surname}`}</td>
                <td className="p-2">{contact.phone}</td>
                <td className="p-2">{contact.email}</td>
                <td className="p-2">{contact.electoral_district}</td>
                <td className="p-2">{contact.poll_id}</td>
                <td className="p-2">
                  <select
                    value={contact.ride_status}
                    onChange={(e) => handleRideStatusChange(contact.id, e.target.value)}
                    className="p-1 border rounded"
                  >
                    <option value="">Select status</option>
                    <option value="needs_ride">Needs Ride</option>
                    <option value="ride_assigned">Ride Assigned</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={contact.voted}
                    onChange={(e) => handleVotedStatusChange(contact.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Bulk Update</h2>
          <div className="flex items-center space-x-4">
            <select name="bulkRideStatus" className="p-2 border rounded">
              <option value="">Select ride status</option>
              <option value="needs_ride">Needs Ride</option>
              <option value="ride_assigned">Ride Assigned</option>
              <option value="picked_up">Picked Up</option>
              <option value="completed">Completed</option>
            </select>
            <select name="bulkVoted" className="p-2 border rounded">
              <option value="">Select voted status</option>
              <option value="true">Voted</option>
              <option value="false">Not Voted</option>
            </select>
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
              Update Selected
            </button>
          </div>
        </div>
      </Form>
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