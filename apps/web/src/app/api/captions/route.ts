import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	generatedCaptions,
	companyProfiles,
	aiUsageLog,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const MODELS = [
	"gemini-2.0-flash",
	"gemini-1.5-flash",
	"gemini-1.5-pro",
	"gemini-flash-latest",
];

const PLATFORM_PROMPTS: Record<string, string> = {
	linkedin: `Escreva uma caption profissional para LinkedIn.
- Tom: profissional mas humano
- Estrutura: gancho forte (1ª linha), desenvolvimento (2-3 parágrafos curtos), CTA claro
- Tamanho: 150-300 palavras
- Hashtags: 3-5 hashtags profissionais no final
- NÃO use emojis em excesso (máximo 2-3 estratégicos)`,

	instagram: `Escreva uma caption envolvente para Instagram.
- Tom: autêntico, visual e emocionante
- Estrutura: frase de impacto (1ª linha que aparece sem expandir), história/contexto, CTA
- Tamanho: 100-200 palavras
- Hashtags: 10-20 hashtags relevantes separadas da caption por quebras de linha
- Use emojis estrategicamente para dar ritmo visual`,

	youtube: `Escreva um título e descrição para YouTube.
- Título: até 60 caracteres, com palavra-chave principal, atraente para SEO
- Descrição: primeiro parágrafo (150 chars) é o mais importante para SEO
- Inclua timestamp dos principais pontos (exemplo: 0:00 Intro, 1:30 Ponto principal)
- Finalize com links relevantes e hashtags (3-5)
- Tom: informativo e direto`,

	tiktok: `Escreva uma caption curta e viral para TikTok.
- Tom: direto, energético, casual
- Tamanho: máximo 150 caracteres (a caption é cortada)
- Comece com gancho forte ou pergunta
- Hashtags: 5-8 trending e relevantes
- Use emojis para chamar atenção`,

	twitter: `Escreva um tweet impactante.
- Tamanho: máximo 280 caracteres
- Tom: direto, provocativo ou reflexivo
- Pode ser uma afirmação forte, pergunta ou insight
- Máximo 2-3 hashtags relevantes
- Se possível, termine com algo que gere reação`,
};

async function callGemini(
	prompt: string,
	apiKey: string,
): Promise<string | null> {
	for (const model of MODELS) {
		try {
			const res = await fetch(
				`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [{ parts: [{ text: prompt }] }],
						generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
					}),
				},
			);
			if (!res.ok) continue;
			const data = await res.json();
			const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
			if (text) return text;
		} catch {}
	}
	return null;
}

export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await req.json();
	const {
		platform,
		clipTitle,
		transcript,
		caption: clipCaption,
		score,
		tone,
		companyName,
		targetAudience,
		industry,
	} = body;

	if (!platform || !clipTitle) {
		return NextResponse.json(
			{ error: "platform e clipTitle são obrigatórios" },
			{ status: 400 },
		);
	}

	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey)
		return NextResponse.json(
			{ error: "GEMINI_API_KEY não configurada" },
			{ status: 500 },
		);

	// Busca perfil da empresa se não veio no body
	let companyContext = `Empresa: ${companyName || "não informada"}`;
	if (!companyName) {
		const [profile] = await db
			.select()
			.from(companyProfiles)
			.where(eq(companyProfiles.userId, session.user.id));
		if (profile) {
			companyContext = `Empresa: ${profile.name} | Setor: ${profile.industry || "não informado"} | Tom: ${profile.tone || "profissional"} | Público: ${profile.targetAudience || "não informado"}`;
		}
	} else {
		companyContext = `Empresa: ${companyName} | Setor: ${industry || "não informado"} | Tom: ${tone || "profissional"} | Público: ${targetAudience || "não informado"}`;
	}

	const platformGuide =
		PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.instagram;

	const prompt = `Você é um especialista em marketing de conteúdo para redes sociais.

CONTEXTO DA EMPRESA:
${companyContext}

CONTEÚDO DO CLIP:
- Título: ${clipTitle}
- Score viral: ${score || "N/A"}/100
- Caption original (referência): ${clipCaption || "não fornecida"}
${transcript ? `- Transcrição do trecho:\n${transcript}` : ""}

PLATAFORMA: ${platform.toUpperCase()}
${platformGuide}

Gere a caption otimizada para ${platform}. Responda SOMENTE com a caption, sem explicações adicionais.`;

	const generated = await callGemini(prompt, apiKey);

	if (!generated) {
		return NextResponse.json(
			{ error: "Falha ao gerar caption com IA" },
			{ status: 500 },
		);
	}

	// Salva no banco
	const [saved] = await db
		.insert(generatedCaptions)
		.values({
			id: nanoid(),
			userId: session.user.id,
			clipTitle,
			platform,
			caption: generated,
			score,
			transcript,
		})
		.returning();

	// Log de uso
	await db
		.insert(aiUsageLog)
		.values({
			id: nanoid(),
			userId: session.user.id,
			provider: "gemini",
			model: "gemini-2.5-flash",
			feature: "caption",
		})
		.catch(() => {});

	return NextResponse.json({ caption: generated, id: saved.id });
}

export async function GET(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const list = await db
		.select()
		.from(generatedCaptions)
		.where(eq(generatedCaptions.userId, session.user.id));

	return NextResponse.json(list);
}
