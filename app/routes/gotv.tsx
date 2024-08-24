import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSettings } from "~/models/settings";
import { getUniqueGroupingValues } from "~/models/contacts";

type LoaderData = {
  groupingField: string;
  campaigns: string[];
  error?:Error
};

export const loader: LoaderFunction = async () => {
  const settings = await getSettings();
  if (!settings.grouping_field){
    return ({groupingField:null, campaigns:null, error:new Error("Campaigns not configured")})
  }
  const groupingField = settings.grouping_field;
  const campaigns = await getUniqueGroupingValues(groupingField);
  return json({ groupingField, campaigns, error:null });
};

export default function GOTV() {
  const { groupingField, campaigns, error } = useLoaderData<LoaderData>();

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl mb-4">Get Out The Vote Campaigns</h1>
      {error && error.message}
      <p className="mb-4">Campaigns grouped by: {groupingField}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns?.map((campaign) => (
          <Link
            key={campaign}
            to={`/gotv/${encodeURIComponent(campaign)}`}
            className="block p-4 border rounded-lg hover:bg-gray-100 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">{campaign}</h2>
            <p className="text-gray-600">View campaign details</p>
          </Link>
        ))}
      </div>
    </div>
  );
}