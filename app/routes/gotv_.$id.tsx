import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useFetcher,
  useTransition,
  useNavigation,
} from "@remix-run/react";
import { getSettings } from "~/models/settings";
import {
  getContactsByGroupingValue,
  updateContactVotedStatus,
} from "~/models/contacts";
import { getUserId } from "~/utils/auth.server";
import { useContacts } from "~/utils/live-update";
import { useFileChanges } from "~/hooks/useFileChanges";
import { useState } from "react";

type LoaderData = {
  userId: string;
  groupingField: string;
  campaign: string;
  contacts: Array<{
    id: number;
    firstname: string;
    surname: string;
    email: string;
    phone: string;
    voted: boolean;
  }>;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  try {
    const settings = await getSettings();
    const groupingField = settings.grouping_field;
    const campaign = params.id;
    if (!campaign) throw new Error("Campaign not found");

    const userId = await getUserId(request);
    if (!userId) {
      return redirect("/login");
    }

    const contacts = await getContactsByGroupingValue(
      groupingField,
      decodeURIComponent(campaign)
    );

    return json<LoaderData>({
      userId,
      groupingField,
      campaign: decodeURIComponent(campaign),
      contacts,
    });
  } catch (error) {
    console.error("Error in GOTV campaign loader:", error);
    throw new Response("An error occurred while loading the campaign", {
      status: 500,
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const contactId = formData.get("contactId");
  const voted = formData.get("voted") === "true";

  if (typeof contactId !== "string") {
    return json({ error: "Invalid contact ID" }, { status: 400 });
  }

  try {
    await updateContactVotedStatus(parseInt(contactId, 10), voted);
    return json({ success: true });
  } catch (error) {
    console.error("Error updating contact voted status:", error);
    return json({ error: "Failed to update voted status" }, { status: 500 });
  }
};

export default function GOTVCampaign() {
  const {
    userId,
    groupingField,
    campaign,
    contacts: initialContacts,
  } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const { contacts, setContacts } = useContacts({ initialContacts });
  const { error: fileChangeError } = useFileChanges(
    "http://localhost:5173",
    userId
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  const handleVotedToggle = (
    contactId: number,
    currentVotedStatus: boolean
  ) => {
    fetcher.submit(
      {
        contactId: contactId.toString(),
        voted: (!currentVotedStatus).toString(),
      },
      { method: "post" }
    );
    setContacts((prevContacts) =>
      prevContacts.map((contact) =>
        contact.id === contactId
          ? { ...contact, voted: !currentVotedStatus }
          : contact
      )
    );
  };

  const filteredContacts = contacts.filter((contact) => {
    const nameMatch = `${contact.firstname} ${contact.surname}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    if (filter === "voted") {
      return nameMatch && contact.voted;
    } else if (filter === "not-voted") {
      return nameMatch && !contact.voted;
    }
    return nameMatch;
  });

  if (navigation.state === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="font-sans p-4">
      <Link to="/gotv" className="text-blue-600 hover:underline mb-4 block">
        ← Back to Campaigns
      </Link>
      <h1 className="text-3xl mb-4">GOTV Campaign: {campaign}</h1>
      <p className="mb-4">Grouped by: {groupingField}</p>
      {fileChangeError && (
        <p className="text-red-500 mb-4">Error: {fileChangeError}</p>
      )}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">All Contacts</option>
          <option value="voted">Voted</option>
          <option value="not-voted">Not Voted</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        {filteredContacts.length === 0 ? (
          <p>No contacts found in this campaign.</p>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="border p-2 rounded flex-col flex gap-2"
            >
              <div>
                {contact.firstname} {contact.surname}
              </div>
              <div className="flex justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">{contact.email}</span>
                  <span className="text-sm text-gray-500">{contact.phone}</span>
                </div>
                <div className="flex items-start w-[150px]">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={contact.voted}
                        onChange={() =>
                          handleVotedToggle(contact.id, contact.voted)
                        }
                      />
                      <div
                        className={`block bg-gray-600 w-14 h-8 rounded-full ${
                          contact.voted ? "bg-green-400" : ""
                        }`}
                      ></div>
                      <div
                        className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                          contact.voted ? "transform translate-x-6" : ""
                        }`}
                      ></div>
                    </div>
                    <div className="ml-3 text-gray-700 font-medium">
                      {contact.voted ? "Voted" : "Not Voted"}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
