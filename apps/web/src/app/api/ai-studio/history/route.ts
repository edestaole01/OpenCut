import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await db.select()
      .from(aiVideoAnalyses)
      .where(eq(aiVideoAnalyses.userId, session.user.id))
      .orderBy(desc(aiVideoAnalyses.createdAt));

    return NextResponse.json(list);
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }
}
