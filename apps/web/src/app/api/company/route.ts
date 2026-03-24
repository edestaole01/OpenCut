import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function getUser(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, user.id));
  return NextResponse.json(profile || null);
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, industry, tone, targetAudience, website, description, logoUrl } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [existing] = await db.select({ id: companyProfiles.id }).from(companyProfiles).where(eq(companyProfiles.userId, user.id));

  if (existing) {
    const [updated] = await db.update(companyProfiles)
      .set({ name, industry, tone, targetAudience, website, description, logoUrl, updatedAt: new Date() })
      .where(eq(companyProfiles.userId, user.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(companyProfiles)
    .values({ id: nanoid(), userId: user.id, name, industry, tone, targetAudience, website, description, logoUrl })
    .returning();
  return NextResponse.json(created);
}
