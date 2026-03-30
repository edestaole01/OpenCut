import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { speakers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function getUser(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user) return null;
	return session.user;
}

export async function GET(req: NextRequest) {
	const user = await getUser(req);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const list = await db
		.select()
		.from(speakers)
		.where(eq(speakers.userId, user.id));
	return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
	const user = await getUser(req);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await req.json();
	const { speakersList } = body; // array de speakers

	if (!Array.isArray(speakersList))
		return NextResponse.json({ error: "Invalid data" }, { status: 400 });

	type SpeakerInput = {
		id?: string;
		name: string;
		role?: string;
		linkedin?: string;
		instagram?: string;
	};

	// Remove todos e reinserere (upsert simples)
	await db.delete(speakers).where(eq(speakers.userId, user.id));

	if (speakersList.length > 0) {
		await db.insert(speakers).values(
			(speakersList as SpeakerInput[]).map((s) => ({
				id: s.id || nanoid(),
				userId: user.id,
				name: s.name,
				role: s.role,
				linkedin: s.linkedin,
				instagram: s.instagram,
			})),
		);
	}

	const list = await db
		.select()
		.from(speakers)
		.where(eq(speakers.userId, user.id));
	return NextResponse.json(list);
}
