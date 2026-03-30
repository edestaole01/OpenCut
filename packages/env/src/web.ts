import { z } from "zod";
const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.url().default("https://api.marblecms.com"),
	// Server
	DATABASE_URL: z
		.string()
		.startsWith("postgres://")
		.or(z.string().startsWith("postgresql://")),
	BETTER_AUTH_SECRET: z.string(),
	UPSTASH_REDIS_REST_URL: z.url(),
	UPSTASH_REDIS_REST_TOKEN: z.string(),
	MARBLE_WORKSPACE_KEY: z.string().optional().default("placeholder"),
	FREESOUND_CLIENT_ID: z.string().optional().default("placeholder"),
	FREESOUND_API_KEY: z.string().optional().default("placeholder"),
	CLOUDFLARE_ACCOUNT_ID: z.string().optional().default("placeholder"),
	R2_ACCESS_KEY_ID: z.string().optional().default("placeholder"),
	R2_SECRET_ACCESS_KEY: z.string().optional().default("placeholder"),
	R2_BUCKET_NAME: z.string().optional().default("placeholder"),
	MODAL_TRANSCRIPTION_URL: z.url().default("https://placeholder.example.com"),
	PEXELS_API_KEY: z.string().optional().default(""),
	GIPHY_API_KEY: z.string().optional().default(""),
});
export type WebEnv = z.infer<typeof webEnvSchema>;
export const webEnv = webEnvSchema.parse(process.env);
