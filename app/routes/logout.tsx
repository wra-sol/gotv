import { logout } from "~/utils/auth.server";

export const action = async ({request}) => {
    return await logout(request);
}