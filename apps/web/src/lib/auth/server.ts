import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { webEnv } from "@opencut/env/web";

// Generate trusted origins for all common localhost ports
const localhostPorts = Array.from({ length: 20 }, (_, i) =>
	`http://localhost:${3000 + i}`
);

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
	}),
	secret: webEnv.BETTER_AUTH_SECRET,
	user: {
		deleteUser: {
			enabled: true,
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	appName: "VideoAI",
	trustedOrigins: [
		...localhostPorts,
		webEnv.NEXT_PUBLIC_SITE_URL,
		"https://opencut-one-kappa.vercel.app",
	],
});

export type Auth = typeof auth;
