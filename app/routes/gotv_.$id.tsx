import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, redirect } from "@remix-run/react";
import { getSettings } from "~/models/settings";
import {
  getContactsByGroupingValue,
  updateContactVotedStatus,
} from "~/models/contacts";
import { useEffect, useState, useCallback, useRef } from "react";
import { getLastChangeId, pollForChanges } from "~/models/live";
import { useFileChanges } from "~/hooks/useFileChanges";
import { getUserId, getUserSession } from "~/utils/auth.server";
import { useContacts } from "~/utils/live-update";

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
  lastChangeId: number;
  hasChanges: boolean;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  const settings = await getSettings();
  const groupingField = settings.grouping_field;
  const campaign = params.id;
  if (!campaign) throw new Error("Campaign not found");
  const userId = await getUserId(request);
  if (!userId) {
    return redirect("/login");
  }

  const url = new URL(request.url);
  const lastKnownChangeId = Number(url.searchParams.get("lastChangeId") || "0");

  const contacts = await getContactsByGroupingValue(
    groupingField,
    decodeURIComponent(campaign)
  );
  const lastChangeId = await getLastChangeId();
  const changes = await pollForChanges(lastKnownChangeId);

  return json({
    userId,
    groupingField,
    campaign: decodeURIComponent(campaign),
    contacts,
    lastChangeId,
    hasChanges: changes.length > 0,
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const contactId = formData.get("contactId");
  const voted = formData.get("voted") === "true";

  if (typeof contactId !== "string") {
    return json({ error: "Invalid contact ID" }, { status: 400 });
  }

  await updateContactVotedStatus(parseInt(contactId, 10), voted);
  return json({ success: true });
};


export default function GOTVCampaign() {
  const {
    userId,
    groupingField,
    campaign,
    contacts: initialContacts,
  } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const {contacts, setContacts, handleUpdate} = useContacts({initialContacts}); 
  const { error } = useFileChanges(`ws://localhost:5173?sessionId=${userId}`, handleUpdate);

  useEffect(() => {
    if (error) {
      console.error("WebSocket error:", error);
      // Implement error handling (e.g., show an error message to the user)
    }
  }, [error]);

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

  return (
    <div className="font-sans p-4">
      <Link to="/gotv" className="text-blue-600 hover:underline mb-4 block">
        ← Back to Campaigns
      </Link>
      <h1 className="text-3xl mb-4">GOTV Campaign: {campaign}</h1>
      <p className="mb-4">Grouped by: {groupingField}</p>
      <div className="flex flex-col gap-2">
        {contacts.length > 0 &&
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="border p-2 rounded flex-col flex gap-2"
            >
              <div>
                {contact.firstname} {contact.surname}
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-500">{contact.email}</span>
                <span className="text-sm text-gray-500">{contact.phone}</span>
              </div>
              <div className="flex items-center">
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
          ))}
      </div>
    </div>
  );
}