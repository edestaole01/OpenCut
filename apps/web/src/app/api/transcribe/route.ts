import { NextResponse } from "next/server";

type GroqWord = { word: string; start: number; end: number };
type GroqSegment = {
	text: string;
	start: number;
	end: number;
	words?: GroqWord[];
};

export async function POST(req: Request) {
	try {
		const formData = await req.formData();
		const audioFile = formData.get("file") as Blob;
		const language = (formData.get("language") as string) || "pt";

		if (!audioFile) {
			return NextResponse.json(
				{ error: "Nenhum arquivo de áudio enviado" },
				{ status: 400 },
			);
		}

		const apiKey = process.env.GROQ_API_KEY;
		if (!apiKey) {
			console.error("GROQ_API_KEY não configurada no servidor");
			return NextResponse.json(
				{ error: "Serviço de transcrição externa não configurado" },
				{ status: 501 },
			);
		}

		// Prepara o FormData para o Groq
		const groqFormData = new FormData();
		groqFormData.append("file", audioFile, "audio.wav");
		groqFormData.append("model", "whisper-large-v3");
		groqFormData.append("response_format", "verbose_json");
		groqFormData.append("timestamp_granularities[]", "word");
		groqFormData.append("timestamp_granularities[]", "segment");

		if (language !== "auto") {
			groqFormData.append("language", language);
		}

		console.log("[Groq API] Enviando áudio para transcrição...");

		const response = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
				body: groqFormData,
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			console.error("[Groq API] Erro na resposta do Groq:", errorData);
			return NextResponse.json(
				{ error: "Erro na API do Groq", details: errorData },
				{ status: response.status },
			);
		}

		const result = await response.json();
		console.log("[Groq API] Transcrição concluída com sucesso");

		// Formata o resultado para o padrão do nosso sistema
		const segments =
			(result.segments as GroqSegment[] | undefined)?.map((s) => ({
				text: s.text,
				start: s.start,
				end: s.end,
				words: s.words?.map((w) => ({
					word: w.word,
					start: w.start,
					end: w.end,
				})),
			})) || [];

		return NextResponse.json({
			text: result.text,
			segments,
			language: result.language || language,
		});
	} catch (error) {
		console.error("[Groq API] Erro crítico:", error);
		return NextResponse.json(
			{ error: "Erro interno ao processar transcrição" },
			{ status: 500 },
		);
	}
}
