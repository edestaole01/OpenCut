import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { WordMap } from "@/core/engine/word-map";

const GROQ_API_BASE = "https://api.groq.com/openai/v1";

const formatTime = (s: number) => {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

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
				model: "llama-3.3-70b-versatile",
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

async function callGroqText(
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
				model: "llama-3.3-70b-versatile",
				messages: [{ role: "user", content: prompt }],
				temperature: 0.1,
			}),
		});

		if (!response.ok) {
			const err = await response.text();
			console.error("Groq Text API error:", err);
			return null;
		}

		const data = await response.json();
		return data.choices?.[0]?.message?.content ?? null;
	} catch (error) {
		console.error("Groq Text call failed:", error);
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
		const isRefinement = formData.get("refine") === "true";
		const refineDataStr = formData.get("refineData") as string;
		const wordMapJson = formData.get("wordMapJson") as string;

		clientTranscriptForFallback = clientTranscript ?? "";
		clientLanguageForFallback = normalizeLanguageHint(clientLanguage);

		if (!video) {
			return NextResponse.json({ error: "No video provided" }, { status: 400 });
		}

		uploadedVideoName = video.name || "Video sem nome";
		uploadedVideoSize = video.size;

		const videoBuffer = await video.arrayBuffer();
		const mimeType = video.type || "video/mp4";

		sourceVideoUrl = await persistSourceVideo({
			videoBuffer,
			videoName: uploadedVideoName,
			mimeType,
		});

		const groqKey = process.env.GROQ_API_KEY;

		// MODE: HIGH-PRECISION REFINEMENT (SYNC HEALING)
		if (isRefinement && refineDataStr) {
			try {
				const { start, end, caption, id } = JSON.parse(refineDataStr);
				const refinePrompt = `You are a professional video editor and subtitler. 
I have a clip that is supposedly from ${formatTime(start)} to ${formatTime(end)}, but the timing might be WRONG (Metadata Drift).
Content: "${caption}".

Your task:
1. Scan the video and FIND exactly where this content is spoken.
2. Provide a VERBATIM transcription.
3. Crucially, find the ACTUAL start time and ACTUAL end time of this speech in the video.

Rules:
- Every 2-3 words MUST have a [MM:SS.mmm] timestamp.
- At the end, provide a "CALIBRATION" line with the absolute start and end of the entire thought.

Example Output:
[00:49.120] Inovação é [00:49.450] sobre conexão...
CALIBRATION: 00:49.120 -> 00:55.300

TRANSCRIPT:`;

				let refinedText: string | null = null;

				if (groqKey) {
					refinedText = await callGroqText(refinePrompt, groqKey);
				}

				// Extract calibration if present to heal sync
				let actualStart = start;
				let actualEnd = end;
				if (refinedText) {
					const calibMatch = refinedText.match(/CALIBRATION:\s*(\d{1,2}:\d{2}(?:\.\d+)?) -> (\d{1,2}:\d{2}(?:\.\d+)?)/i);
					if (calibMatch) {
						const parseTime = (t: string) => {
							const [m, s] = t.split(":").map(Number);
							return m * 60 + s;
						};
						actualStart = parseTime(calibMatch[1]);
						actualEnd = parseTime(calibMatch[2]);
						console.log(`[SyncHealing] Corrected ${id}: ${start}s -> ${actualStart}s`);
					}
				}

				return NextResponse.json({
					success: true,
					refinedTranscript: refinedText,
					clipId: id,
					actualStart,
					actualEnd
				});
			} catch (e) {
				console.error("Refinement failed:", e);
				return NextResponse.json({ error: "Internal refinement error" }, { status: 500 });
			}
		}

		let text: string | null = null;
		const prompt = getPrompt(clientTranscript, clientLanguageForFallback);
		const clientTranscriptTrimmed = clientTranscript?.trim() ?? "";

		// Groq-only analysis
		if (groqKey) {
			console.log("Using Groq for analysis...");
			text = await callGroq(prompt, groqKey);
		}

		if (!text && !groqKey) {
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

		// No Groq response -> fallback

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
				console.warn("Failed to parse AI JSON, using fallback:", parseErr);
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

		// Align clips with transcript timestamps to fix "start: 0" or incorrect times from AI
		if (result.clips.length > 0 && typeof result.transcript === "string") {
			let words: any[] | undefined;
			if (wordMapJson) {
				try {
					words = JSON.parse(wordMapJson);
				} catch (e) {
					console.warn("Failed to parse wordMapJson", e);
				}
			}

			result.clips = alignClipsWithTranscript(
				result.clips as any[],
				result.transcript,
				words,
			);
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

		// Include the word list in the response so the client can use it for OPE immediately
		const finalResponse = {
			...resultWithSource,
			words: words || [], // Pass back the words used for alignment
		};

		return NextResponse.json(finalResponse);
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
		.replace(/(?:\[|\()?(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?:\]|\))?/g, "")
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
): Array<{ start: number; end: number; text: string }> {
	// Usa alternação para distinguir claramente HH:MM:SS de MM:SS.
	// Grupo 1,2,3 = HH:MM:SS; Grupo 4,5 = MM:SS.
	// Grupo 6 = milissegundos (opcional).
	// Grupo 7 = texto após o timestamp até o próximo timestamp.
	const regex = /(?:[\[\(])?(?:(\d{1,2}):(\d{2}):(\d{2})|(\d{1,2}):(\d{2}))(?:[.,](\d{1,3}))?(?:[\]\)])?[ \t]*([\s\S]*?)(?=(?:[\[\(])?(?:\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})|$)/g;
	const temp: Array<{ start: number; text: string }> = [];

	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
	while ((match = regex.exec(transcript)) !== null) {
		let start: number;
		if (match[1] !== undefined) {
			// Formato HH:MM:SS
			start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
		} else if (match[4] !== undefined) {
			// Formato MM:SS
			start = Number(match[4]) * 60 + Number(match[5]);
		} else {
			continue;
		}

		// Adiciona milissegundos se presentes
		if (match[6] !== undefined) {
			const msStr = match[6].padEnd(3, "0");
			start += Number(msStr) / 1000;
		}

		const text = (match[7] ?? "").trim();
		if (text) {
			temp.push({ start, text });
		}
	}

	const segments: Array<{ start: number; end: number; text: string }> = [];
	for (let i = 0; i < temp.length; i++) {
		const nextStart = temp[i + 1]?.start ?? temp[i].start + 30;
		segments.push({
			start: temp[i].start,
			end: nextStart,
			text: temp[i].text,
		});
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

	// Only use signals that are unambiguously Spanish and rare in Portuguese.
	// Avoid "el", "la", "los", "las" — they appear naturally in PT names/brands.
	const spanishOnlySignals = [
		/\bperfecto\b/,       // PT would be "perfeito"
		/\bexcelente\b/,      // shared, but combined with others is suspicious
		/\bestás\b/,          // PT is "está" (no accent on s)
		/\bseguidores\b/,     // PT is "seguidores" — actually same, skip
		/\bvídeos?\b.*\btus\b/, // "tus vídeos" is clearly Spanish
		/\besto\s+es\b/,      // PT would be "isso é"
		/\bpara\s+ti\b/,      // PT would be "para você" or "para ti" (rare)
		/\bcon\s+el\b/,       // "con el" is Spanish; PT is "com o"
		/\bque\s+te\b/,       // "que te" — common in ES; less so in PT
		/¡/,                  // inverted exclamation — exclusively Spanish
		/¿/,                  // inverted question — exclusively Spanish
	];

	const hits = spanishOnlySignals.reduce((acc, pattern) => {
		return acc + (pattern.test(text) ? 1 : 0);
	}, 0);

	// Require at least 2 unambiguous signals to avoid false positives
	return hits >= 2;
}

function getPrompt(clientTranscript?: string, languageHint = "pt") {
	const transcriptGuidance = clientTranscript
		? `Use the following TRANSCRIPT as the ONLY source of truth for identifying clips and captions. 
The TRANSCRIPT represents the audio of the video from start to finish.
DO NOT use text from outside this transcript. DO NOT paraphrase or summarize unless asked.
CRITICAL: The "start" and "end" values for each clip MUST reflect the actual time in the video as shown in the [MM:SS] timestamps. If the first spoken word in a clip starts at [00:23], then "start" MUST be 23.

TRANSCRIPT:
${clientTranscript}

`
		: "Transcribe EXACTLY what is spoken in the video, word for word. Do NOT paraphrase, summarize, or add words that were not said. Use the language spoken in the video (do not translate). Add a [MM:SS] timestamp at the start of each sentence or every ~10 seconds. CRITICAL: Your clips start/end times MUST be accurate based on your transcription.";

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
If I provided a transcript above, return it exactly as is (or formatted with [MM:SS] timestamps if missing). If not, transcribe the video word-for-word. CRITICAL: Add a [MM:SS] timestamp at the START OF EVERY SINGLE SENTENCE. Accuracy is priority.

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
      "caption": "engaging caption",
      "firstWords": "exact first 5-8 words spoken"
    }
  ],
  "transcript": "[00:00] words spoken here..."
}

Rules:
- mainTitle: same language as the video
- transcript: must contain [MM:SS] timestamps FOR EVERY SENTENCE (CRITICAL for sync)
- clips start/end: integer seconds (CRITICAL: MUST match transcript timestamps)
- score: 0-100
- tags: Hook, Tutorial, Story, Tip, CTA`;
}

/**
 * Strip hashtags, emojis, URLs, and marketing noise from caption text
 * before matching against transcript segments.
 */
function extractSpokenWords(caption: string): string[] {
	return caption
		.replace(/#\w+/g, " ")               // remove hashtags
		.replace(/https?:\/\/\S+/g, " ")     // remove URLs
		.replace(/[^\p{L}\p{N}\s]/gu, " ")   // remove emojis and punctuation
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 3);
}

/**
 * For every clip, find the transcript segment whose text best matches the
 * clip's caption using TEXTUAL match only (no temporal snap).
 *
 * Match threshold: >= 30% of the caption words must appear in the segment.
 *
 * Correction is asymmetric:
 * - clip starts > 3s BEFORE the matched segment → correct
 *   (video was running before the speech started)
 * - clip starts > 8s AFTER the matched segment → correct
 *   (AI placed the clip too late)
 * - Otherwise → keep the AI's original timing (small differences are intentional)
 *
 * Duration is always preserved from the original clip.
 * Minimum corrected duration is 25s only when original < 5s (likely an AI error).
 */
function alignClipsWithTranscript(
	clips: Array<any>,
	transcript: string,
	wordList?: any[],
): Array<any> {
	const MIN_MATCH_RATIO = 0.25;
	const MIN_WORD_MATCHES = 2;
	const TEMPORAL_BUFFER = 10.0; // Reduced to 10s to keep context locked and stable

	const segments = extractTimestampSegments(transcript);
	if (segments.length === 0) return clips;

	// Phase 2: High-precision WordMap
	let engine: WordMap | null = null;
	if (wordList && Array.isArray(wordList) && wordList.length > 0) {
		const formattedWords = wordList.map((w, idx) => ({
			id: `w-${idx}`,
			text: w.word || w.text || "",
			start: w.start,
			end: w.end,
			confidence: 1.0,
			isPunctuation: false,
		}));
		engine = new WordMap(formattedWords);
	}

	return clips.map((clip) => {
		const clipStart: number = clip.start || 0;
		const clipEnd: number = clip.end || 0;
		const caption = clip.caption || "";
		// Use firstWords for anchor search if available, fallback to caption
		const searchAnchor = clip.firstWords || caption;
		const words = extractSpokenWords(searchAnchor);

		// 1. Try ultra-precise WordMap first if engine is available
		if (engine && searchAnchor) {
			const range = engine.findPhrase(searchAnchor, clipStart);
			if (range) {
				const startW = engine.getWord(range.startId);
				const endW = engine.getWord(range.endId);
				if (startW && endW) {
					// Apply Smart Padding even in precision mode
					const paddedStart = Math.max(0, startW.start - 0.15);
					const paddedEnd = endW.end + 0.3;

					return {
						...clip,
						start: Number(paddedStart.toFixed(2)),
						end: Number(paddedEnd.toFixed(2)),
					};
				}
			}
		}

		// 2. Fallback to Range-Based segment alignment
		const relevantSegments = segments.filter((seg) => {
			const overlap =
				Math.min(seg.end, clipEnd + TEMPORAL_BUFFER) -
				Math.max(seg.start, clipStart - TEMPORAL_BUFFER);
			const hasTemporalOverlap = overlap > 0.5;

			let matches = 0;
			if (words.length >= 2) {
				const segText = seg.text.toLowerCase();
				for (const w of words) {
					if (segText.includes(w)) matches++;
				}
			}
			const hasTextualOverlap =
				matches >= MIN_WORD_MATCHES && matches >= words.length * MIN_MATCH_RATIO;

			return hasTemporalOverlap || hasTextualOverlap;
		});

		if (relevantSegments.length > 0) {
			relevantSegments.sort((a, b) => a.start - b.start);

			const textualMatches = relevantSegments.filter((seg) => {
				let m = 0;
				const st = seg.text.toLowerCase();
				for (const w of words) if (st.includes(w)) m++;
				return m >= MIN_WORD_MATCHES && m >= words.length * MIN_MATCH_RATIO;
			});

			let foundStart = relevantSegments[0].start;
			const foundEnd = relevantSegments[relevantSegments.length - 1].end;

			if (textualMatches.length > 0) {
				foundStart = textualMatches[0].start;
			}

			const paddedStart = Math.max(0, foundStart - 0.15);
			const paddedEnd = foundEnd + 0.3;

			const originalDuration = clipEnd - clipStart;
			const newDuration = paddedEnd - paddedStart;
			
			// Increased sanity check tolerance for unreliable AI
			const isSane =
				(newDuration <= originalDuration * 3.0 || originalDuration < 15) &&
				newDuration >= originalDuration * 0.1;

			if (isSane) {
				return {
					...clip,
					start: Number(paddedStart.toFixed(2)),
					end: Number(paddedEnd.toFixed(2)),
				};
			}
		}

		return clip;
	});
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
