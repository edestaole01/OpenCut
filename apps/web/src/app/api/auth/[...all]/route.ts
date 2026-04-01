import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
