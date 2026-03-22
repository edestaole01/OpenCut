import { createAuthClient } from "better-auth/react";
import { webEnv } from "@opencut/env/web";

export const { signIn, signUp, signOut, useSession } = createAuthClient({
	baseURL: webEnv.NEXT_PUBLIC_SITE_URL,
});
