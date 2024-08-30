import React, { useState, useEffect, useCallback } from "react";
import {
  json,
  type ActionFunction,
  type LoaderFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useNavigate,
  Link,
  useNavigation,
  useFetcher,
} from "@remix-run/react";
import {
  getContacts,
  Contact,
  getUniqueGroupingValues,
} from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";
import { CustomField, getCustomFields } from "~/models/settings";
import {
  bulkCreateOrUpdateInteractions,
  getLatestInteractionByContactId,
  Interaction,
} from "~/models/interactions";

type LoaderData = {
  contacts: (Contact & { latestInteraction: Interaction & {custom_fields: Record<string, any>} })[];
  total: number;
  electoralDistricts: string[];
  pollIds: string[];
  customFields: CustomField[];
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

type Change = {
  contactId: number;
  custom_fields: Record<string, any>;
};


export const loader: LoaderFunction = async ({ request }) => {
  try {
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
    const sortKey = url.searchParams.get("sortKey") || "id";
    const sortDirection = url.searchParams.get("sortDirection") || "asc";
  
    const offset = (page - 1) * limit;
    const { contacts, total } = await getContacts({ offset, limit, filters, sortKey, sortDirection });
    const electoralDistricts = await getUniqueGroupingValues(
      "electoral_district"
    );
    const pollIds = await getUniqueGroupingValues("poll_id");
    const customFields = await getCustomFields("canvass");
    const contactsWithLatestInteraction = await Promise.all(
      contacts.map(async (contact) => {
        const latestInteraction = await getLatestInteractionByContactId(
          contact.id
        );
        return { ...contact, latestInteraction };
      })
    );
    return json({
      contacts: contactsWithLatestInteraction,
      total,
      electoralDistricts,
      pollIds,
      customFields,
    });
  } catch (error) {
    console.error("Error in Canvass loader:", error);
    return json(
      { error: "An error occurred while loading the data" },
      { status: 500 }
    );
  }
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  
  const data = await request.json();
  const changes = JSON.parse(data.changes);

  try {
    await bulkCreateOrUpdateInteractions(changes, userId);
    return json({ success: true });
  } catch (error) {
    console.error("Error in action function:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};


export default function Canvass() {
  const loaderData = useLoaderData<LoaderData>();
  const [contacts, setContacts] = useState<Contact[]>(loaderData?.contacts);
  const [changes, setChanges] = useState<Change[]>([]);

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

  const fetcher = useFetcher();
  const navigate = useNavigate();
  const navigation = useNavigation();

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

  const applyFilters = useCallback(() => {
    setPage(1);
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    searchParams.append("page", "1");
    searchParams.append("limit", limit.toString());
    navigate(`?${searchParams.toString()}`);
  }, [filters, limit, navigate]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("page", newPage.toString());
    navigate(`?${searchParams.toString()}`);
  }, [navigate]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("limit", newLimit.toString());
    searchParams.set("page", "1");
    navigate(`?${searchParams.toString()}`);
  }, [navigate]);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      supportLevel: "",
      wantsSign: "",
      willVolunteer: "",
      planToVote: "",
      electoralDistrict: "",
      pollId: "",
    });
    navigate(`?page=1&limit=${limit}`);
  }, [limit, navigate]);

  const handleDataChange = useCallback((contactId: number, fieldName: string, value: any) => {
    setChanges(prevChanges => {
      const existingChangeIndex = prevChanges.findIndex(change => change.contactId === contactId);
      if (existingChangeIndex !== -1) {
        const updatedChanges = [...prevChanges];
        updatedChanges[existingChangeIndex] = {
          ...updatedChanges[existingChangeIndex],
          custom_fields: {
            ...updatedChanges[existingChangeIndex]?.custom_fields,
            [fieldName]: value
          }
        };
        return updatedChanges;
      } else {
        return [...prevChanges, { contactId, custom_fields: { [fieldName]: value } }];
      }
    });

    setContacts(prevContacts => 
      prevContacts.map(contact => 
        contact.id === contactId
          ? {
              ...contact,
              latestInteraction: {
                ...contact?.latestInteraction,
                custom_fields: {
                  ...contact?.latestInteraction?.custom_fields,
                  [fieldName]: value
                }
              },
            }
          : contact
      )
    );
  }, []);

  const commitChanges = useCallback(() => {
    fetcher.submit(
      { changes: JSON.stringify(changes) },
      { method: "post", encType: "application/json" }
    );
    // Clear changes after submitting
    setChanges([]);
  }, [changes, fetcher]);


  if (navigation.state === "loading") {
    return <div className="p-4">Loading...</div>;
  }
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Canvass</h1>
      <Form
        method="get"
        className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <input
          type="text"
          name="search"
          placeholder="Search"
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          className="p-2 border rounded"
        />
        <select
          name="supportLevel"
          value={filters.supportLevel}
          onChange={(e) => handleFilterChange("supportLevel", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Support Levels</option>
          <option value="strong">Strong</option>
          <option value="lean">Lean</option>
          <option value="undecided">Undecided</option>
          <option value="opposed">Opposed</option>
        </select>
        <select
          name="wantsSign"
          value={filters.wantsSign}
          onChange={(e) => handleFilterChange("wantsSign", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">Wants Sign</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        <select
          name="willVolunteer"
          value={filters.willVolunteer}
          onChange={(e) => handleFilterChange("willVolunteer", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">Will Volunteer</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        <select
          name="planToVote"
          value={filters.planToVote}
          onChange={(e) => handleFilterChange("planToVote", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">Plan to Vote</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="undecided">Undecided</option>
        </select>
        <select
          name="electoralDistrict"
          value={filters.electoralDistrict}
          onChange={(e) =>
            handleFilterChange("electoralDistrict", e.target.value)
          }
          className="p-2 border rounded"
        >
          <option value="">All Electoral Districts</option>
          {loaderData.electoralDistricts?.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
        <select
          name="pollId"
          value={filters.pollId}
          onChange={(e) => handleFilterChange("pollId", e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Poll IDs</option>
          {loaderData.pollIds?.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <div className="col-span-full flex justify-between">
          <button
            type="button"
            onClick={applyFilters}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Clear Filters
          </button>
        </div>
      </Form>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Address</th>
            <th className="p-2 text-left">Recent Contact</th>
            {loaderData.customFields?.map((field) => (
              <th key={field.id} className="p-2 text-left">
                {field.field_name}
              </th>
            ))}
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
                {contact.latestInteraction ? (
                  <>
                    Last Interaction:{" "}
                    {new Date(contact.latestInteraction.created_at).toLocaleString()}
                  </>
                ) : (
                  <>-</>
                )}
              </td>
              {loaderData.customFields.map((field) => (
                <td key={field.id} className="p-2">
                  {renderCustomField(
                    field,
                    contact,
                    (fieldName, value) =>
                      handleDataChange(contact.id, fieldName, value)
                  )}
                </td>
              ))}
              <td className="p-2">
                <Link
                  to={`/contacts/${contact.id}`}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={commitChanges}
        disabled={changes.length === 0}
        className="bg-green-500 text-white px-4 py-2 rounded mb-4 disabled:bg-gray-300"
      >
        Commit Changes ({changes.length})
      </button>

      <div className="flex justify-between items-center">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          Previous
        </button>
        <span>
          Page {page} of {Math.ceil(loaderData.total / limit)}
        </span>
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page === Math.ceil(loaderData.total / limit)}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function renderCustomField(
  field: CustomField,
  contact: Contact & { latestInteraction: Interaction },
  onUpdate: (fieldName: string, value: string | boolean) => void
) {
  const value = contact.latestInteraction?.custom_fields?.[field.field_name] || "";

  switch (field.field_type) {
    case "text":
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onUpdate(field.field_name, e.target.value)}
          className="p-1 border rounded w-full"
        />
      );
    case "select":
      return (
        <select
          value={value}
          onChange={(e) => onUpdate(field.field_name, e.target.value)}
          className="p-1 border rounded w-full"
        >
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onUpdate(field.field_name, e.target.checked)}
        />
      );
    default:
      return <span>{value}</span>;
  }
}
