import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";

async function getSessionUserId(request: NextRequest): Promise<string | null> {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user?.id ?? null;
}

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ id: string }> | { id: string } },
) {
	try {
		const userId = await getSessionUserId(request);
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const params = await context.params;
		const id = params?.id;
		if (!id) {
			return NextResponse.json({ error: "ID inválido" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));
		const videoName =
			typeof body.videoName === "string" ? body.videoName.trim() : "";

		if (!videoName) {
			return NextResponse.json(
				{ error: "Nome do vídeo é obrigatório" },
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
				{ error: "Registro não encontrado" },
				{ status: 404 },
			);
		}

		return NextResponse.json(updated);
	} catch (error) {
		console.error("History rename error:", error);
		return NextResponse.json(
			{ error: "Erro ao renomear item do histórico" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	context: { params: Promise<{ id: string }> | { id: string } },
) {
	try {
		const userId = await getSessionUserId(request);
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const params = await context.params;
		const id = params?.id;
		if (!id) {
			return NextResponse.json({ error: "ID inválido" }, { status: 400 });
		}

		const [deleted] = await db
			.delete(aiVideoAnalyses)
			.where(
				and(eq(aiVideoAnalyses.id, id), eq(aiVideoAnalyses.userId, userId)),
			)
			.returning({ id: aiVideoAnalyses.id });

		if (!deleted) {
			return NextResponse.json(
				{ error: "Registro não encontrado" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true, id: deleted.id });
	} catch (error) {
		console.error("History delete error:", error);
		return NextResponse.json(
			{ error: "Erro ao excluir item do histórico" },
			{ status: 500 },
		);
	}
}
