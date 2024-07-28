import { json, redirect } from "@remix-run/node";
import { getUserSession } from "~/utils/auth.server";

export async function loader({ request }) {
  const session = await getUserSession(request);
  const userId = session.get('userId');
  if (!userId){
    return redirect('/login')
  }
  return json({ userId });
}