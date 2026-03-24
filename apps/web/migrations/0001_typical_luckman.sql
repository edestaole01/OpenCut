-- Custom SQL migration file, put your code below! --

CREATE TABLE IF NOT EXISTS "ai_video_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"video_name" text NOT NULL,
	"video_size" integer,
	"result" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "ai_video_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

ALTER TABLE "ai_video_analyses" ENABLE ROW LEVEL SECURITY;