import {
	pgTable,
	text,
	timestamp,
	boolean,
	pgEnum,
	integer,
	jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "user"]);

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	role: roleEnum("role").default("user").notNull(),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
}).enableRLS();

export const accounts = pgTable("accounts", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
}).enableRLS();

export const verifications = pgTable("verifications", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
}).enableRLS();

export const aiConfigs = pgTable("ai_configs", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(),
	apiKey: text("api_key").notNull(),
	model: text("model").notNull(),
	feature: text("feature").notNull(),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

export const companyProfiles = pgTable("company_profiles", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	industry: text("industry"),
	tone: text("tone"),
	targetAudience: text("target_audience"),
	website: text("website"),
	description: text("description"),
	logoUrl: text("logo_url"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

// Personagens/Speakers cadastrados
export const speakers = pgTable("speakers", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	role: text("role"),
	linkedin: text("linkedin"),
	instagram: text("instagram"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

// Captions geradas pela IA
export const generatedCaptions = pgTable("generated_captions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	clipTitle: text("clip_title").notNull(),
	platform: text("platform").notNull(), // linkedin, instagram, youtube, tiktok, twitter
	caption: text("caption").notNull(),
	hashtags: text("hashtags"),
	score: integer("score"),
	transcript: text("transcript"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

// Biblioteca de hashtags e CTAs
export const hashtagLibrary = pgTable("hashtag_library", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tag: text("tag").notNull(),
	category: text("category"), // hashtag, cta, keyword
	platform: text("platform"), // all, linkedin, instagram, tiktok
	usageCount: integer("usage_count").default(0),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

// Log de uso de IA (controle de gastos)
export const aiUsageLog = pgTable("ai_usage_log", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(), // groq
	model: text("model").notNull(),
	feature: text("feature").notNull(), // analyze, caption, translate
	tokensUsed: integer("tokens_used"),
	costUsd: text("cost_usd"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();

// Armazenamento das análises completas do AI Studio
export const aiVideoAnalyses = pgTable("ai_video_analyses", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	videoName: text("video_name").notNull(),
	videoSize: integer("video_size"),
	result: jsonb("result").notNull(), // { clips: Clip[], transcript: string }
	createdAt: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
}).enableRLS();
