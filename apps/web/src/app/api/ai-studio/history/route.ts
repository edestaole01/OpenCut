import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";

async function getSessionUserId(req: NextRequest): Promise<string | null> {
	const session = await auth.api.getSession({ headers: req.headers });
	return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const list = await db
			.select()
			.from(aiVideoAnalyses)
			.where(eq(aiVideoAnalyses.userId, userId))
			.orderBy(desc(aiVideoAnalyses.createdAt));

		return NextResponse.json(list);
	} catch (error) {
		console.error("History fetch error:", error);
		return NextResponse.json(
			{ error: "Erro ao buscar historico" },
			{ status: 500 },
		);
	}
}

export async function PATCH(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const id = req.nextUrl.searchParams.get("id")?.trim();
		if (!id) {
			return NextResponse.json({ error: "ID invalido" }, { status: 400 });
		}

		const body = await req.json().catch(() => ({}));
		const videoName =
			typeof body.videoName === "string" ? body.videoName.trim() : "";

		if (!videoName) {
			return NextResponse.json(
				{ error: "Nome do video e obrigatorio" },
				{ status: 400 },
			);
		}

		const [updated] = await db
			.update(aiVideoAnalyses)
			.set({ videoName })
			.where(
				and(eq(aiVideoAnalyses.id, id), eq(aiVideoAnalyses.userId, userId)),
			)
			.returning();

		if (!updated) {
			return NextResponse.json(
				{ error: "Registro nao encontrado" },
				{ status: 404 },
			);
		}

		return NextResponse.json(updated);
	} catch (error) {
		console.error("History rename error:", error);
		return NextResponse.json(
			{ error: "Erro ao renomear item do historico" },
			{ status: 500 },
		);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const id = req.nextUrl.searchParams.get("id")?.trim();
		if (!id) {
			return NextResponse.json({ error: "ID invalido" }, { status: 400 });
		}

		const [deleted] = await db
			.delete(aiVideoAnalyses)
			.where(
				and(eq(aiVideoAnalyses.id, id), eq(aiVideoAnalyses.userId, userId)),
			)
			.returning({ id: aiVideoAnalyses.id });

		if (!deleted) {
			return NextResponse.json(
				{ error: "Registro nao encontrado" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true, id: deleted.id });
	} catch (error) {
		console.error("History delete error:", error);
		return NextResponse.json(
			{ error: "Erro ao excluir item do historico" },
			{ status: 500 },
		);
	}
}
