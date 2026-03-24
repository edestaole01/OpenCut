import { createAuthClient } from "better-auth/react";

// baseURL not set = uses current browser origin automatically (works on any port)
export const { signIn, signUp, signOut, useSession } = createAuthClient({});
