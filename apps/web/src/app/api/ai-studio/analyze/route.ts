import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

type GeminiModel = {
	name: string;
	supportedGenerationMethods?: string[];
};

type GeminiContentPart =
	| { text: string }
	| { file_data: { mime_type: string; file_uri: string } }
	| { inline_data: { mime_type: string; data: string } };

async function callGroq(
	prompt: string,
	apiKey: string,
): Promise<string | null> {
	try {
		const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "llama-3.3-70b-specdec",
				messages: [{ role: "user", content: prompt }],
				temperature: 0.3,
				response_format: { type: "json_object" },
			}),
		});

		if (!response.ok) {
			const err = await response.text();
			console.error("Groq API error:", err);
			return null;
		}

		const data = await response.json();
		return data.choices?.[0]?.message?.content ?? null;
	} catch (error) {
		console.error("Groq call failed:", error);
		return null;
	}
}

function getVideoExtension({
	fileName,
	mimeType,
}: {
	fileName: string;
	mimeType: string;
}): string {
	const fromName = extname(fileName).replace(".", "").trim().toLowerCase();
	if (fromName) return fromName;
	if (mimeType.includes("quicktime")) return "mov";
	if (mimeType.includes("webm")) return "webm";
	if (mimeType.includes("x-matroska")) return "mkv";
	if (mimeType.includes("avi")) return "avi";
	return "mp4";
}

async function persistSourceVideo({
	videoBuffer,
	videoName,
	mimeType,
}: {
	videoBuffer: ArrayBuffer;
	videoName: string;
	mimeType: string;
}): Promise<string | null> {
	try {
		const extension = getVideoExtension({ fileName: videoName, mimeType });
		const fileName = `${Date.now()}-${nanoid()}.${extension}`;
		const uploadDir = join(process.cwd(), "public", "uploads", "ai-studio");
		await mkdir(uploadDir, { recursive: true });
		await writeFile(join(uploadDir, fileName), Buffer.from(videoBuffer));
		return `/uploads/ai-studio/${fileName}`;
	} catch (error) {
		console.error("Failed to persist source video:", error);
		return null;
	}
}

function attachSourceVideo<T extends Record<string, unknown>>({
	result,
	sourceVideoUrl,
}: {
	result: T;
	sourceVideoUrl: string | null;
}): T {
	if (!sourceVideoUrl) return result;
	return {
		...result,
		sourceVideoUrl,
	};
}

async function saveAnalysisHistory({
	userId,
	videoName,
	videoSize,
	result,
}: {
	userId: string;
	videoName: string;
	videoSize: number;
	result: Record<string, unknown>;
}) {
	await db
		.insert(aiVideoAnalyses)
		.values({
			id: nanoid(),
			userId,
			videoName,
			videoSize,
			result,
		})
		.catch((err) => console.error("Erro ao salvar analise:", err));
}

// Upload video using Gemini File API (supports files up to 2GB)
async function uploadVideoToGemini(
	videoBuffer: ArrayBuffer,
	mimeType: string,
	apiKey: string,
): Promise<string> {
	const numBytes = videoBuffer.byteLength;

	const initRes = await fetch(
		`${GEMINI_API_BASE}/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
		{
			method: "POST",
			headers: {
				"X-Goog-Upload-Protocol": "resumable",
				"X-Goog-Upload-Command": "start",
				"X-Goog-Upload-Header-Content-Length": numBytes.toString(),
				"X-Goog-Upload-Header-Content-Type": mimeType,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ file: { display_name: "video_upload" } }),
		},
	);

	if (!initRes.ok) {
		throw new Error(`File API init failed: ${initRes.status}`);
	}

	const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
	if (!uploadUrl) throw new Error("No upload URL returned");

	const uploadRes = await fetch(uploadUrl, {
		method: "POST",
		headers: {
			"Content-Length": numBytes.toString(),
			"X-Goog-Upload-Offset": "0",
			"X-Goog-Upload-Command": "upload, finalize",
		},
		body: videoBuffer,
	});

	if (!uploadRes.ok) {
		throw new Error(`File upload failed: ${uploadRes.status}`);
	}

	const fileData = await uploadRes.json();
	const fileUri = fileData.file?.uri;
	if (!fileUri) throw new Error("No file URI in response");

	let fileState = fileData.file?.state;
	let attempts = 0;
	while (fileState === "PROCESSING" && attempts < 30) {
		await new Promise((resolve) => setTimeout(resolve, 5000));
		const statusRes = await fetch(
			`${GEMINI_API_BASE}/v1beta/files/${fileData.file.name.split("/").pop()}?key=${apiKey}`,
		);
		const statusData = await statusRes.json();
		fileState = statusData.state ?? statusData.file?.state;
		attempts++;
	}

	if (fileState !== "ACTIVE") {
		throw new Error(`File not ready: ${fileState}`);
	}

	return fileUri;
}

export async function POST(request: NextRequest) {
	let userId: string | null = null;
	let sourceVideoUrl: string | null = null;
	let uploadedVideoName = "Video sem nome";
	let uploadedVideoSize = 0;
	let clientTranscriptForFallback = "";
	let clientLanguageForFallback = "pt";

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		userId = session.user.id;

		const formData = await request.formData();
		const video = formData.get("video") as File;
		const thumbnail = formData.get("thumbnail") as string;
		const clientTranscript = formData.get("transcript") as string;
		const clientLanguage = formData.get("language") as string;
		const requestedProvider = formData.get("provider") as string;
		clientTranscriptForFallback = clientTranscript ?? "";
		clientLanguageForFallback = normalizeLanguageHint(clientLanguage);

		if (!video) {
			return NextResponse.json({ error: "No video provided" }, { status: 400 });
		}

		uploadedVideoName = video.name || "Video sem nome";
		uploadedVideoSize = video.size;

		const videoBuffer = await video.arrayBuffer();
		const mimeType = video.type || "video/mp4";
		const fileSizeMB = videoBuffer.byteLength / (1024 * 1024);

		sourceVideoUrl = await persistSourceVideo({
			videoBuffer,
			videoName: uploadedVideoName,
			mimeType,
		});

		const geminiKey = process.env.GEMINI_API_KEY;
		const groqKey = process.env.GROQ_API_KEY;

		let text: string | null = null;
		const prompt = getPrompt(clientTranscript, clientLanguageForFallback);
		const clientTranscriptTrimmed = clientTranscript?.trim() ?? "";

		// Se o usuário pediu Groq e temos transcrição, tentamos Groq primeiro
		if (requestedProvider === "groq" && groqKey && clientTranscriptTrimmed) {
			console.log("Using Groq for analysis as requested...");
			text = await callGroq(prompt, groqKey);
		}

		if (!text && !geminiKey) {
			const mockResult = attachSourceVideo({
				result: getMockResult(),
				sourceVideoUrl,
			});
			if (clientTranscript) mockResult.transcript = clientTranscript;
			await saveAnalysisHistory({
				userId,
				videoName: `${uploadedVideoName} (Demo)`,
				videoSize: uploadedVideoSize,
				result: mockResult,
			});
			return NextResponse.json(mockResult);
		}

		if (!text) {
			try {
				const listRes = await fetch(
					`${GEMINI_API_BASE}/v1beta/models?key=${geminiKey}&pageSize=50`,
				);
				if (listRes.ok) {
					const listData = await listRes.json();
					const videoCapableModels = (listData.models || [])
						.filter(
							(model: GeminiModel) =>
								model.supportedGenerationMethods?.includes("generateContent") &&
								(model.name.includes("flash") || model.name.includes("pro")),
						)
						.map((model: GeminiModel) => model.name);
					console.log(
						"Available Gemini models:",
						videoCapableModels.join(", "),
					);
				}
			} catch {
				// ignore model list failures
			}

			console.log(`Video size: ${fileSizeMB.toFixed(1)}MB, type: ${mimeType}`);

			let contentParts: GeminiContentPart[];

			if (clientTranscriptTrimmed) {
				console.log(
					"Using client transcript for analysis (no video upload required)...",
				);
				contentParts = [{ text: prompt }];
			} else if (fileSizeMB > 80) {
				console.log("File >80MB: using Gemini File API...");
				console.log("Using Gemini File API for large video...");
				if (!geminiKey) {
					throw new Error("Gemini API key ausente para upload de vídeo");
				}
				try {
					const fileUri = await uploadVideoToGemini(
						videoBuffer,
						mimeType,
						geminiKey,
					);
					contentParts = [
						{ text: prompt },
						{ file_data: { mime_type: mimeType, file_uri: fileUri } },
					];
				} catch (uploadErr) {
					console.error("File API upload failed:", uploadErr);
					if (clientTranscriptTrimmed) {
						const fallbackResult = attachSourceVideo({
							result: getTranscriptFallbackResult(clientTranscriptTrimmed),
							sourceVideoUrl,
						});
						await saveAnalysisHistory({
							userId,
							videoName: `${uploadedVideoName} (Falha Upload)`,
							videoSize: uploadedVideoSize,
							result: fallbackResult,
						});
						return NextResponse.json(fallbackResult);
					} else {
						const fallbackResult = attachSourceVideo({
							result: getFallbackResult(),
							sourceVideoUrl,
						});
						await saveAnalysisHistory({
							userId,
							videoName: `${uploadedVideoName} (Falha Upload)`,
							videoSize: uploadedVideoSize,
							result: fallbackResult,
						});
						return NextResponse.json(fallbackResult);
					}
				}
			} else {
				console.log("Using inline base64 for small video...");
				const videoBase64 = Buffer.from(videoBuffer).toString("base64");
				contentParts = [
					{ text: prompt },
					{ inline_data: { mime_type: mimeType, data: videoBase64 } },
				];
			}

			const models = [
				"gemini-1.5-flash",
				"gemini-2.0-flash",
				"gemini-1.5-pro",
				"gemini-2.0-flash-001",
			];

			let quotaErrors = 0;

			for (const model of models) {
				try {
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 150000);
					const response = await fetch(
						`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${geminiKey}`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							signal: controller.signal,
							body: JSON.stringify({
								contents: [{ parts: contentParts }],
								generationConfig: {
									temperature: 0.3,
									maxOutputTokens: 8192,
								},
							}),
						},
					);
					clearTimeout(timeoutId);

					if (!response.ok) {
						if (response.status === 429) {
							quotaErrors += 1;
						}
						const errText = await response.text().catch(() => "");
						console.warn(
							`Model ${model} failed (${response.status}):`,
							errText.slice(0, 200),
						);
						if (quotaErrors >= 2) break;
						continue;
					}

					const data = await response.json();
					text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
					if (text) break;
				} catch (modelErr) {
					console.warn(`Model ${model} error:`, modelErr);
				}
			}
		}

		if (!text) {
			const fallbackResult = attachSourceVideo({
				result: getFallbackResult({
					clientTranscript: clientTranscriptTrimmed,
				}),
				sourceVideoUrl,
			});
			await saveAnalysisHistory({
				userId,
				videoName: `${uploadedVideoName} (Falha AI)`,
				videoSize: uploadedVideoSize,
				result: fallbackResult,
			});
			return NextResponse.json(fallbackResult);
		}

		const cleaned = text
			.replace(/```json\n?/g, "")
			.replace(/```\n?/g, "")
			.trim();
		const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

		let result: Record<string, unknown> | null = null;
		if (jsonMatch) {
			try {
				result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			} catch (parseErr) {
				console.warn("Failed to parse Gemini JSON, using fallback:", parseErr);
			}
		}

		if (!result) {
			const fallbackResult = attachSourceVideo({
				result: getFallbackResult({
					clientTranscript: clientTranscriptTrimmed,
				}),
				sourceVideoUrl,
			});
			await saveAnalysisHistory({
				userId,
				videoName: `${uploadedVideoName} (Sem JSON)`,
				videoSize: uploadedVideoSize,
				result: fallbackResult,
			});
			return NextResponse.json(fallbackResult);
		}

		if (
			clientLanguageForFallback === "pt" &&
			clientTranscript &&
			isLikelySpanishAnalysisResult(result)
		) {
			result = getTranscriptFallbackResult(clientTranscript);
		}

		if (
			typeof result.transcript !== "string" ||
			result.transcript.length < 20
		) {
			if (clientTranscript?.trim()) {
				result = {
					...result,
					transcript: clientTranscript,
					transcriptSource: "client",
					isMock: false,
				};
			} else {
				result = {
					...result,
					transcript:
						"Transcricao nao retornada pela IA. Verifique o audio do video e tente novamente.",
				};
			}
		}

		if (!Array.isArray(result.clips)) {
			result = {
				...result,
				clips: [],
			};
		}

		if (thumbnail) {
			result = {
				...result,
				thumbnail,
			};
		}

		const finalVideoName =
			(typeof result.mainTitle === "string" && result.mainTitle.trim()) ||
			uploadedVideoName;

		const resultWithSource = attachSourceVideo({
			result,
			sourceVideoUrl,
		});

		await saveAnalysisHistory({
			userId,
			videoName: finalVideoName,
			videoSize: uploadedVideoSize,
			result: resultWithSource,
		});

		return NextResponse.json(resultWithSource);
	} catch (error) {
		const errorCode =
			typeof error === "object" && error !== null && "code" in error
				? String((error as { code?: unknown }).code ?? "")
				: "";
		const errorMessage = error instanceof Error ? error.message : String(error);
		const isClientAbort =
			errorCode === "ECONNRESET" ||
			errorMessage.toLowerCase().includes("aborted");

		if (isClientAbort) {
			console.warn("Analyze request aborted by client timeout.");
		} else {
			console.error("Analyze error:", error);
		}

		const fallbackResult = attachSourceVideo({
			result: getFallbackResult({
				clientTranscript: clientTranscriptForFallback,
			}),
			sourceVideoUrl,
		});

		if (userId) {
			await saveAnalysisHistory({
				userId,
				videoName: `${uploadedVideoName} (Erro)`,
				videoSize: uploadedVideoSize,
				result: fallbackResult,
			});
		}

		return NextResponse.json(fallbackResult);
	}
}

function getFallbackResult({
	clientTranscript,
}: {
	clientTranscript?: string;
} = {}): Record<string, unknown> {
	if (clientTranscript?.trim()) {
		return getTranscriptFallbackResult(clientTranscript);
	}

	return getMockResult();
}

function getTranscriptFallbackResult(
	transcriptInput: string,
): Record<string, unknown> {
	const transcript = transcriptInput.replace(/\s+/g, " ").trim();
	const tags = ["Hook", "Tutorial", "Story", "Tip", "CTA"];
	const timedSegments = extractTimestampSegments(transcript);

	let clips: Array<{
		id: string;
		title: string;
		start: number;
		end: number;
		score: number;
		tag: string;
		caption: string;
	}> = [];

	if (timedSegments.length > 0) {
		// Filtra segmentos muito curtos (< 50 caracteres) que podem ser ruído ou sem contexto
		const validSegments = timedSegments.filter((s) => s.text.length > 50);

		clips = validSegments.slice(0, 6).map((segment, index, all) => {
			// Tenta criar clips de pelo menos 15-30 segundos unindo segmentos se necessário
			const nextStart = all[index + 1]?.start ?? segment.start + 25;
			const end = Math.max(segment.start + 15, nextStart);
			const cleanText = cleanupTimestampText(segment.text);

			return {
				id: String(index + 1),
				title: index === 0 ? "Abertura Estratégica" : `Destaque ${index + 1}`,
				start: segment.start,
				end,
				score: Math.max(70, 92 - index * 4),
				tag: tags[index % tags.length] ?? "Tip",
				caption: buildCaptionFromText(cleanText),
			};
		});
	} else {
		// Fallback baseado em sentenças completas para manter o contexto
		const sentences = transcript
			.split(/(?<=[.!?])\s+/)
			.map((item) => item.trim())
			.filter((item) => item.split(/\s+/).length > 8); // Pelo menos 8 palavras para ter contexto

		// Se não houver sentenças longas o suficiente, faz o chunking mas com blocos maiores
		const source =
			sentences.length >= 3
				? sentences
				: chunkTextByWords({
						text: transcript,
						wordsPerChunk: 45,
						maxChunks: 8,
					});

		let cursorSeconds = 0;

		clips = source.slice(0, 6).map((sentence, index) => {
			const wordCount = sentence.split(/\s+/).filter(Boolean).length;
			// Duração mínima de 15s e máxima de 50s para clips mais naturais e contextuais
			const duration = Math.max(15, Math.min(50, Math.ceil(wordCount / 1.8)));
			const start = cursorSeconds;
			const end = start + duration;
			cursorSeconds = end;

			return {
				id: String(index + 1),
				title: index === 0 ? "Gancho Inicial" : `Parte ${index + 1}`,
				start,
				end,
				score: Math.max(65, 90 - index * 5),
				tag: tags[index % tags.length] ?? "Tip",
				caption: buildCaptionFromText(sentence),
			};
		});
	}

	// Remove clips duplicados ou que terminam antes de começar (sanidade)
	clips = clips.filter((c) => c.end > c.start + 5);

	return {
		isMock: false,
		analysisMode: "transcript-fallback",
		transcriptSource: "client",
		mainTitle: buildTitleFromTranscript(transcript),
		clips,
		transcript,
	};
}

function chunkTextByWords({
	text,
	wordsPerChunk,
	maxChunks,
}: {
	text: string;
	wordsPerChunk: number;
	maxChunks: number;
}): string[] {
	const words = text
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
	if (words.length === 0) return [];

	const chunks: string[] = [];
	for (
		let index = 0;
		index < words.length && chunks.length < maxChunks;
		index += wordsPerChunk
	) {
		const chunk = words
			.slice(index, index + wordsPerChunk)
			.join(" ")
			.trim();
		if (chunk) chunks.push(chunk);
	}

	return chunks.length > 0 ? chunks : [text];
}

function buildTitleFromTranscript(transcript: string): string {
	const cleaned = cleanupTimestampText(transcript)
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (!cleaned) return "Conteudo analisado";
	const words = cleaned.split(" ").slice(0, 6).join(" ");
	return words.length > 50 ? `${words.slice(0, 47)}...` : words;
}

function cleanupTimestampText(text: string): string {
	return text
		.replace(/\[\d{1,2}:\d{2}\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function buildCaptionFromText(text: string): string {
	const cleaned = cleanupTimestampText(text);
	if (!cleaned) return "Trecho relevante identificado neste momento.";
	return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function extractTimestampSegments(
	transcript: string,
): Array<{ start: number; text: string }> {
	const regex = /\[(\d{1,2}):(\d{2})\]\s*([\s\S]*?)(?=(\[\d{1,2}:\d{2}\])|$)/g;
	const segments: Array<{ start: number; text: string }> = [];
	let match: RegExpExecArray | null = regex.exec(transcript);

	while (match) {
		const minutes = Number(match[1] ?? 0);
		const seconds = Number(match[2] ?? 0);
		const text = (match[3] ?? "").trim();
		const start = minutes * 60 + seconds;
		if (text) {
			segments.push({ start, text });
		}
		match = regex.exec(transcript);
	}

	return segments;
}

function normalizeLanguageHint(language?: string): string {
	const normalized = (language || "").toLowerCase().trim();
	if (normalized.startsWith("pt")) return "pt";
	if (normalized.startsWith("es")) return "es";
	if (normalized.startsWith("en")) return "en";
	return "pt";
}

function isLikelySpanishAnalysisResult(
	result: Record<string, unknown>,
): boolean {
	const title = typeof result.mainTitle === "string" ? result.mainTitle : "";
	const clips = Array.isArray(result.clips) ? result.clips : [];
	const clipText = clips
		.map((clip) => {
			if (typeof clip !== "object" || clip === null) return "";
			const obj = clip as Record<string, unknown>;
			return `${typeof obj.title === "string" ? obj.title : ""} ${
				typeof obj.caption === "string" ? obj.caption : ""
			}`;
		})
		.join(" ");

	const text = `${title} ${clipText}`.toLowerCase();
	if (!text.trim()) return false;

	const spanishSignals = [
		/\bel\b/,
		/\bla\b/,
		/\blos\b/,
		/\blas\b/,
		/\bsube\b/,
		/\bdeja\b/,
		/\bperfecto\b/,
		/\bestas\b/,
		/¡/,
	];

	const hits = spanishSignals.reduce((acc, pattern) => {
		return acc + (pattern.test(text) ? 1 : 0);
	}, 0);

	return hits >= 2;
}

function getPrompt(clientTranscript?: string, languageHint = "pt") {
	const transcriptGuidance = clientTranscript
		? `Use the following TRANSCRIPT as the ONLY source of truth for identifying clips and captions. 
The TRANSCRIPT represents the audio of the video from start to finish.
DO NOT use text from outside this transcript. DO NOT paraphrase or summarize unless asked.

TRANSCRIPT:
${clientTranscript}

`
		: "Transcribe EXACTLY what is spoken in the video, word for word. Do NOT paraphrase, summarize, or add words that were not said. Use the language spoken in the video (do not translate). Add a [MM:SS] timestamp at the start of each sentence or every ~10 seconds.";

	const languageRule =
		languageHint === "pt"
			? "Output language MUST be Brazilian Portuguese (pt-BR). Never output Spanish."
			: languageHint === "es"
				? "Output language MUST be Spanish (es)."
				: "Output language MUST be English (en).";

	return `You are a video content analysis expert specializing in short-form viral content.

${transcriptGuidance}
${languageRule}

Your task has THREE parts:

PART 1 - VIDEO TITLE:
Create a short, creative and catchy title for this video content (max 50 characters).

PART 2 - VERBATIM TRANSCRIPTION (Only if not provided above):
If I provided a transcript above, return it exactly as is (or formatted with [MM:SS] timestamps if missing). If not, transcribe the video word-for-word.

PART 3 - VIRAL CLIPS:
Identify 4-8 of the most impactful moments for social media (TikTok, Reels, Shorts). 
Each clip MUST be between 15 and 60 seconds long. DO NOT create clips shorter than 10 seconds.
For each clip, write an engaging caption in the same language as the video.

Return ONLY valid JSON, no markdown, no explanations:
{
  "mainTitle": "Catchy Video Title",
  "clips": [
    {
      "id": "1",
      "title": "descriptive title",
      "start": 0,
      "end": 18,
      "score": 88,
      "tag": "Hook",
      "caption": "engaging caption"
    }
  ],
  "transcript": "[00:00] words spoken here..."
}

Rules:
- mainTitle: same language as the video
- transcript: must contain [MM:SS] timestamps
- clips start/end: integer seconds
- score: 0-100
- tags: Hook, Tutorial, Story, Tip, CTA`;
}

function getMockResult(): Record<string, unknown> {
	return {
		isMock: true,
		transcriptSource: "mock",
		clips: [
			{
				id: "1",
				title: "Trecho inicial",
				start: 0,
				end: 18,
				score: 70,
				tag: "Gancho",
				caption: "Transcricao automatica indisponivel neste modo.",
			},
		],
		transcript:
			"MODO DEMO: a IA nao conseguiu gerar a transcricao real deste video.",
	};
}
