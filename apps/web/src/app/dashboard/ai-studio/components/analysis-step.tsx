"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	CheckCircle2,
	Loader2,
	ArrowLeft,
	Brain,
	Sparkles,
	Wand2,
	Film,
	MessageSquare,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractTimelineAudio, getVideoInfo } from "@/lib/media/mediabunny";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";

type AnalysisResult = {
	transcript: string;
	language: string;
	clips: Array<{
		id: string;
		title: string;
		start: number;
		end: number;
		score: number;
		tag: string;
		caption: string;
	}>;
	thumbnail?: string;
};

type MockElement = {
	id: string;
	type: "video";
	mediaId: string;
	name: string;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
};

type MockTrack = {
	id: string;
	type: "video";
	elements: MockElement[];
};

type MockMediaAsset = { id: string; file: File; type: "video" };

interface AnalysisStepProps {
	videoFile: File;
	onAnalysisComplete: (result: AnalysisResult) => void;
	onBack: () => void;
	autoStart?: boolean;
}

const AI_TIPS = [
	"Sabia que os primeiros 3 segundos de um vídeo decidem se o usuário vai continuar assistindo?",
	"Vídeos verticais têm 4x mais engajamento no Instagram e TikTok do que vídeos horizontais.",
	"Legendas coloridas aumentam o tempo de retenção em até 40% em vídeos curtos.",
	"Ganchos que começam com uma pergunta costumam ter mais comentários.",
	"A IA está analisando os picos de áudio e mudanças de cena para encontrar os cortes perfeitos.",
	"O tom de voz e a velocidade da fala influenciam diretamente na percepção de autoridade.",
];

const STATUS_MESSAGES = [
	{ label: "Enviando vídeo para a nuvem segura...", icon: Film },
	{ label: "IA assistindo e processando os frames...", icon: Brain },
	{
		label: "Transcrevendo falas e identificando palavras-chave...",
		icon: MessageSquare,
	},
	{ label: "Detectando momentos de alto impacto emocional...", icon: Zap },
	{ label: "Cruzando dados com padrões de viralidade...", icon: Sparkles },
	{ label: "Finalizando os melhores clips para você...", icon: Wand2 },
];

const CLIP_LABELS = ["Gancho", "Tutorial", "Story", "Dica", "CTA", "Destaque"];
const CLIP_LABEL_COLORS: Record<string, string> = {
	Gancho:
		"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
	Tutorial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
	Story: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
	Dica: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
	CTA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
	Destaque:
		"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

/** Extrai N frames do vídeo em timestamps distribuídos uniformemente */
async function extractThumbnails(file: File, count: number): Promise<string[]> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement("video");
		video.src = url;
		video.muted = true;
		video.preload = "metadata";
		video.crossOrigin = "anonymous";

		const thumbs: string[] = [];
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		video.onloadedmetadata = () => {
			const duration = video.duration;
			if (!duration || !ctx) {
				URL.revokeObjectURL(url);
				resolve([]);
				return;
			}

			// Usa as dimensões reais do vídeo para evitar distorção
			const maxSize = 320;
			if (video.videoWidth > video.videoHeight) {
				canvas.width = maxSize;
				canvas.height = Math.round(
					(video.videoHeight / video.videoWidth) * maxSize,
				);
			} else {
				canvas.height = maxSize;
				canvas.width = Math.round(
					(video.videoWidth / video.videoHeight) * maxSize,
				);
			}

			let captured = 0;
			const timestamps = Array.from(
				{ length: count },
				(_, i) => (duration / (count + 1)) * (i + 1),
			);

			const cleanup = () => {
				// Desanexa o vídeo antes de revogar para evitar ERR_FILE_NOT_FOUND
				video.pause();
				video.onseeked = null;
				video.onerror = null;
				video.onloadedmetadata = null;
				video.removeAttribute("src");
				video.load();
				URL.revokeObjectURL(url);
			};

			const captureNext = () => {
				if (captured >= count) {
					cleanup();
					resolve(thumbs);
					return;
				}
				video.currentTime = timestamps[captured];
			};

			video.onseeked = () => {
				try {
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
				} catch {
					thumbs.push("");
				}
				captured++;
				captureNext();
			};

			captureNext();
		};

		video.onerror = () => {
			URL.revokeObjectURL(url);
			resolve([]);
		};
	});
}

interface ThumbCard {
	thumb: string;
	label: string;
	revealed: boolean;
	score: number;
}

async function withTimeout<T>({
	promise,
	timeoutMs,
	timeoutMessage,
}: {
	promise: Promise<T>;
	timeoutMs: number;
	timeoutMessage: string;
}): Promise<T> {
	let timeoutId: number | null = null;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutId = window.setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
	}
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
	return chunks;
}

function isAudioCueOnlyText(raw: string): boolean {
	const normalized = raw
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

	if (!normalized) return true;

	return (
		/^(?:\[(?:musica|music|som|sons|noise|ruido|silencio)\]\s*)+$/i.test(
			normalized,
		) ||
		normalized === "musica" ||
		normalized === "[musica]" ||
		normalized === "music" ||
		normalized === "[music]"
	);
}

function ensureTimestampedTranscript(
	text: string,
	durationSec?: number,
): string {
	const hasMarkers =
		/(?:\[|\()?([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?(?:\]|\))?/.test(text);
	if (hasMarkers || !text.trim()) return text;

	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);

	const safeDuration =
		durationSec && durationSec > 0
			? durationSec
			: Math.max(sentences.length, 1) * 5;
	const slice = safeDuration / Math.max(1, sentences.length);

	const formatTime = (sec: number) => {
		const total = Math.max(0, Math.floor(sec));
		const m = Math.floor(total / 60)
			.toString()
			.padStart(2, "0");
		const s = (total % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	return sentences
		.map((sentence, index) => `[${formatTime(index * slice)}] ${sentence}`)
		.join("\n");
}

function buildLocalAnalysisFromTranscript(
	transcriptInput: string,
	videoDurationSec?: number,
) {
	const transcript = transcriptInput.replace(/\s+/g, " ").trim();
	const useTranscript =
		transcript.length > 0 && !isAudioCueOnlyText(transcript);
	if (!useTranscript) {
		return {
			isMock: true,
			analysisMode: "local-fallback",
			transcriptSource: "local",
			transcript: "",
			clips: [],
		};
	}

	const tags = ["Hook", "Tutorial", "Story", "Tip", "CTA"];

	// Aumentado wordsPerChunk para 60 para clips mais longos e naturais (aprox 20-30s)
	const chunks = useTranscript
		? chunkTextByWords({
				text: transcript,
				wordsPerChunk: 60,
				maxChunks: 100,
			})
		: [
				"Edite a legenda deste trecho com a fala correta.",
				"Ajuste este corte para destacar o ponto principal.",
				"Use um gancho curto e objetivo neste momento.",
				"Inclua uma dica pratica para aumentar retencao.",
				"Finalize com CTA claro para gerar acao.",
			];

	let clips = chunks.map((chunk, index) => {
		return {
			id: String(index + 1),
			title: index === 0 ? "Trecho inicial" : `Trecho ${index + 1}`,
			start: 0,
			end: 0,
			score: Math.max(60, 92 - index * 2),
			tag: tags[index % tags.length] ?? "Tip",
			caption: chunk.length > 120 ? `${chunk.slice(0, 117)}...` : chunk,
		};
	});

	if (videoDurationSec && videoDurationSec > 0 && clips.length > 0) {
		const count = clips.length;
		const slice = videoDurationSec / count;
		clips = clips.map((clip, index) => {
			const start = index * slice;
			const end = (index + 1) * slice;
			return {
				...clip,
				start,
				end: Math.min(videoDurationSec, end),
			};
		});
	} else {
		// Fallback manual se não tiver duração
		let cursor = 0;
		clips = clips.map((clip) => {
			const duration = 10; // Default 10s
			const start = cursor;
			const end = start + duration;
			cursor = end;
			return { ...clip, start, end };
		});
	}

	return {
		isMock: false,
		analysisMode: "local-fallback",
		transcriptSource: useTranscript ? "client" : "local",
		transcript: useTranscript ? transcript : "",
		clips,
	};
}

export function AnalysisStep({
	videoFile,
	onAnalysisComplete,
	onBack,
	autoStart = false,
}: AnalysisStepProps) {
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
	const [currentTipIndex, setCurrentTipIndex] = useState(0);
	const [progress, setProgress] = useState(0);
	const [thumbCards, setThumbCards] = useState<ThumbCard[]>([]);
	const [thumbsReady, setThumbsReady] = useState(false);
	const [provider, setProvider] = useState<"gemini" | "groq">("gemini");
	const analysisStarted = useRef(false);

	/** Extrai thumbnails assim que o componente monta */
	useEffect(() => {
		let cancelled = false;
		extractThumbnails(videoFile, 5).then((thumbs) => {
			if (cancelled) return;
			const cards: ThumbCard[] = thumbs.map((thumb, i) => ({
				thumb,
				label: CLIP_LABELS[i % CLIP_LABELS.length],
				revealed: false,
				score: Math.floor(65 + Math.random() * 30),
			}));
			setThumbCards(cards);
			setThumbsReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [videoFile]);

	/** Revela os cards progressivamente conforme o progresso avança */
	useEffect(() => {
		if (!isAnalyzing || !thumbsReady) return;
		const revealAt = [20, 35, 50, 65, 80]; // % em que cada card aparece
		setThumbCards((prev) =>
			prev.map((card, i) => ({
				...card,
				revealed: card.revealed || progress >= (revealAt[i] ?? 90),
			})),
		);
	}, [progress, isAnalyzing, thumbsReady]);

	/** Carrossel de dicas apenas */
	useEffect(() => {
		if (!isAnalyzing) return;

		const tipInterval = setInterval(() => {
			setCurrentTipIndex((prev) => (prev + 1) % AI_TIPS.length);
		}, 6000);

		return () => {
			clearInterval(tipInterval);
		};
	}, [isAnalyzing]);

	const startAnalysis = useCallback(async () => {
		if (analysisStarted.current) return;
		analysisStarted.current = true;
		setIsAnalyzing(true);
		setProgress(2);
		let transcriptionText = "";
		let transcriptionLanguage = "pt";
		let videoDurationSec = 0;

		try {
			// 0. Obter informações básicas do vídeo
			const videoInfo = await getVideoInfo({ videoFile });
			videoDurationSec = videoInfo.duration;

			// 1. Extração de Áudio e Transcrição Real
			setCurrentStatusIndex(2); // Passo: Transcrevendo...
			setProgress(10);

			console.log("[Analysis] Extracting audio for transcription...", {
				videoFile: videoFile.name,
				duration: videoDurationSec,
			});

			// Simula estrutura mínima para extração de áudio
			const mockTrack: MockTrack = {
				id: "main",
				type: "video" as const,
				elements: [
					{
						id: "v1",
						type: "video" as const,
						mediaId: "m1",
						name: videoFile.name,
						startTime: 0,
						duration: videoDurationSec,
						trimStart: 0,
						trimEnd: 0,
					},
				],
			};

			const audioBlob = await extractTimelineAudio({
				tracks: [mockTrack],
				mediaAssets: [
					{ id: "m1", file: videoFile, type: "video" } satisfies MockMediaAsset,
				],
				totalDuration: videoDurationSec,
				onProgress: (p) => setProgress(10 + p * 0.15), // 10-25%
			});

			console.log("[Analysis] Audio blob extracted:", {
				size: audioBlob.size,
				type: audioBlob.type,
			});

			setProgress(25);
			// console.log("[Analysis] Audio blob extracted:", { size: audioBlob.size, type: audioBlob.type });

			setProgress(30);
			console.log(
				"[Analysis] Starting transcription (Groq first, fallback local)...",
			);
			try {
				const { samples, sampleRate } = await decodeAudioToFloat32({
					audioBlob,
				});
				const transcription = await withTimeout({
					promise: transcriptionService.transcribe({
						audioData: audioBlob, // Passa o Blob original para o Groq
						samples: samples, // Passa Float32Array para permitir fallback local se remoto falhar
						useRemote: true,
						sampleRate,
						onProgress: (p) => {
							if (p.status === "loading-model") {
								setProgress(30 + p.progress * 0.15);
							} else {
								setProgress(45 + p.progress * 0.25);
							}
						},
					}),
					timeoutMs: 90000, // 90s antes do fallback
					timeoutMessage: "Tempo limite da transcrição excedido",
				});

				console.log("[Analysis] Transcription result received:", {
					textLength: transcription.text?.length || 0,
					language: transcription.language,
					preview: transcription.text?.slice(0, 50),
				});

				const rawTranscript = transcription.text || "";
				const looksOnlyAudioCue = isAudioCueOnlyText(rawTranscript);
				transcriptionText =
					rawTranscript.length > 30 || !looksOnlyAudioCue ? rawTranscript : "";
				transcriptionLanguage = transcription.language || "pt";
				transcriptionText = ensureTimestampedTranscript(
					transcriptionText,
					videoDurationSec,
				);

				if (!transcriptionText) {
					console.warn("[Analysis] Transcription text is too short or empty!");
				}
			} catch (transcriptionError) {
				transcriptionService.cancel();
				console.error(
					"[Analysis] Transcription critical error:",
					transcriptionError,
				);
				// Garante que transcriptionText esteja vazio para acionar o fallback
				transcriptionText = "";
			}

			// 2. Capturar Thumbnail para a API (Simplificado para evitar travamentos)
			setCurrentStatusIndex(1); // Passo: Frames...
			setProgress(72);
			let thumbnailBase64 = "";
			try {
				console.log("[Analysis] Capturing thumbnail...");
				thumbnailBase64 = await new Promise((resolve) => {
					const video = document.createElement("video");
					video.muted = true;
					const url = URL.createObjectURL(videoFile);
					video.src = url;
					let settled = false;

					const finalize = (value: string) => {
						if (settled) return;
						settled = true;
						clearTimeout(timeout);
						video.onloadedmetadata = null;
						video.onseeked = null;
						video.onerror = null;
						resolve(value);
					};

					const timeout = setTimeout(() => {
						console.warn("[Analysis] Thumbnail timeout");
						finalize("");
					}, 5000);

					video.onloadedmetadata = () => {
						videoDurationSec = Number.isFinite(video.duration)
							? video.duration
							: videoDurationSec;
						video.currentTime = Math.min(1, video.duration / 2);
					};
					video.onseeked = () => {
						const canvas = document.createElement("canvas");
						canvas.width = 320;
						canvas.height = 180;
						const ctx = canvas.getContext("2d");
						ctx?.drawImage(video, 0, 0, 320, 180);
						const data = canvas.toDataURL("image/jpeg", 0.6);
						finalize(data);
					};
					video.onerror = () => {
						console.error("[Analysis] Thumbnail video error");
						finalize("");
					};
				});
			} catch (thumbErr) {
				console.warn(
					"[Analysis] Failed to generate thumbnail, continuing anyway",
					thumbErr,
				);
			}

			// 3. Chamar API com Transcrição Real
			setCurrentStatusIndex(4); // Passo: Cruzando dados...
			setProgress(75);
			console.log("[Analysis] Calling analysis API...");

			const formData = new FormData();
			formData.append("video", videoFile);
			if (transcriptionText) formData.append("transcript", transcriptionText);
			formData.append("language", transcriptionLanguage);
			if (thumbnailBase64) formData.append("thumbnail", thumbnailBase64);
			formData.append("provider", provider);

			const controller = new AbortController();
			const timeoutId = window.setTimeout(() => controller.abort(), 120000);
			let response: Response;
			try {
				response = await fetch("/api/ai-studio/analyze", {
					method: "POST",
					body: formData,
					signal: controller.signal,
				});
			} finally {
				window.clearTimeout(timeoutId);
			}

			if (response.ok) {
				console.log("[Analysis] API call successful");
				const result = await response.json();
				if (
					transcriptionText &&
					(!Array.isArray(result.clips) || result.clips.length === 0)
				) {
					Object.assign(
						result,
						buildLocalAnalysisFromTranscript(
							transcriptionText,
							videoDurationSec,
						),
					);
				} else if (transcriptionText) {
					result.transcript = transcriptionText;
					result.isMock = false;
					result.transcriptSource = "client";
				}

				setCurrentStatusIndex(5);
				setProgress(100);
				setTimeout(() => onAnalysisComplete(result), 500);
			} else {
				console.error(
					"[Analysis] API call failed with status:",
					response.status,
				);
				const localResult = buildLocalAnalysisFromTranscript(
					transcriptionText,
					videoDurationSec,
				);
				setCurrentStatusIndex(5);
				setProgress(100);
				setTimeout(() => onAnalysisComplete(localResult), 500);
				return;
			}
		} catch (err) {
			const isAbortError =
				err instanceof DOMException && err.name === "AbortError";

			if (isAbortError) {
				console.warn("[Analysis] API timeout reached, using local fallback.");
			} else {
				console.error("[Analysis] Process failed:", err);
			}

			const localResult = buildLocalAnalysisFromTranscript(
				transcriptionText,
				videoDurationSec,
			);
			setCurrentStatusIndex(5);
			setProgress(100);
			setTimeout(() => onAnalysisComplete(localResult), 500);
		}
	}, [videoFile, onAnalysisComplete, provider]);

	useEffect(() => {
		if (autoStart) startAnalysis();
	}, [autoStart, startAnalysis]);

	return (
		<div className="space-y-5 max-w-2xl mx-auto">
			<Card className="overflow-hidden border-primary/20">
				<CardContent className="p-0">
					{!isAnalyzing ? (
						/* ── Tela inicial ── */
						<div className="p-10 text-center space-y-8 bg-gradient-to-b from-primary/5 to-background">
							<div className="relative inline-block">
								<div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
									<Brain className="w-12 h-12 text-primary" />
								</div>
								<div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-2 shadow-lg animate-bounce">
									<Sparkles className="w-4 h-4 text-white" />
								</div>
							</div>

							<div className="space-y-2">
								<h2 className="text-2xl font-bold tracking-tight">
									{videoFile.name}
								</h2>
								<p className="text-muted-foreground max-w-md mx-auto text-sm">
									Nossa IA vai identificar os momentos mais virais, gerar
									legendas e transcrever cada palavra.
								</p>
							</div>

							{/* Preview de thumbnails antes de analisar */}
							{thumbsReady && thumbCards.length > 0 && (
								<div className="flex gap-2 justify-center">
									{thumbCards.map((card, i) => (
										<div
											key={card.thumb || `${card.label}-${i}`}
											className="w-16 h-10 rounded-md overflow-hidden border bg-muted flex-shrink-0 opacity-60 flex items-center justify-center"
										>
											{card.thumb ? (
												<Image
													src={card.thumb}
													alt=""
													width={64}
													height={40}
													className="w-full h-full object-contain"
												/>
											) : (
												<div className="w-full h-full bg-muted" />
											)}
										</div>
									))}
								</div>
							)}

							{/* Seletor de Provedor */}
							<div className="flex flex-col items-center gap-3">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
									Escolha a Inteligência
								</p>
								<div className="flex p-1 bg-muted rounded-xl border border-border/50 max-w-sm w-full">
									<button
										type="button"
										onClick={() => setProvider("gemini")}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
											provider === "gemini"
												? "bg-background text-primary shadow-sm"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										<Brain className="w-4 h-4" />
										Google Gemini
										<span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded opacity-70">
											Padrão
										</span>
									</button>
									<button
										type="button"
										onClick={() => setProvider("groq")}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
											provider === "groq"
												? "bg-background text-yellow-600 dark:text-yellow-500 shadow-sm"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										<Zap className="w-4 h-4 fill-current" />
										Groq Llama
										<span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-1.5 rounded opacity-70">
											Ultra Rápido
										</span>
									</button>
								</div>
								<p className="text-[10px] text-muted-foreground italic">
									{provider === "gemini"
										? "Ideal para vídeos longos e análise visual profunda."
										: "Ideal para cortes rápidos e análise de transcrição em alta velocidade."}
								</p>
							</div>

							<div className="flex gap-4 justify-center">
								<Button
									variant="outline"
									onClick={onBack}
									className="h-12 px-6"
								>
									<ArrowLeft className="w-4 h-4 mr-2" />
									Voltar
								</Button>
								<Button
									onClick={startAnalysis}
									size="lg"
									className="h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20"
								>
									Começar Análise <Wand2 className="w-4 h-4" />
								</Button>
							</div>
						</div>
					) : (
						/* ── Tela de processamento ── */
						<div className="p-8 space-y-8">
							{/* Status Header */}
							<div className="text-center space-y-3">
								<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
									<Loader2 className="w-3 h-3 animate-spin" /> Processando com
									IA
								</div>
								<h2 className="text-xl font-bold transition-all duration-500">
									{STATUS_MESSAGES[currentStatusIndex].label}
								</h2>
								<p className="text-muted-foreground text-xs">
									Por favor, não feche esta aba.
								</p>
							</div>

							{/* Barra de progresso */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs font-medium text-muted-foreground">
									<span className="flex items-center gap-1.5 text-primary">
										{(() => {
											const Icon = STATUS_MESSAGES[currentStatusIndex].icon;
											return <Icon className="w-3.5 h-3.5" />;
										})()}
										Etapa {currentStatusIndex + 1} de {STATUS_MESSAGES.length}
									</span>
									<span className="tabular-nums">{Math.round(progress)}%</span>
								</div>
								<Progress value={progress} className="h-2.5 rounded-full" />
							</div>

							{/* Thumbnails progressivas */}
							{thumbCards.length > 0 && (
								<div className="space-y-2">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Clips identificados
									</p>
									<div className="grid grid-cols-5 gap-2">
										{thumbCards.map((card, i) => (
											<div
												key={card.thumb || `${card.label}-${i}`}
												className={cn(
													"space-y-1.5 transition-all duration-700",
													card.revealed
														? "opacity-100 translate-y-0"
														: "opacity-0 translate-y-4 pointer-events-none",
												)}
											>
												{/* Thumbnail */}
												<div className="relative h-20 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
													{card.thumb ? (
														<Image
															src={card.thumb}
															alt={`Clip ${i + 1}`}
															width={200}
															height={120}
															className="w-full h-full object-contain"
														/>
													) : (
														<div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
															<Film className="w-4 h-4 text-muted-foreground/40" />
														</div>
													)}
													{/* Score badge */}
													<div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
														{card.score}
													</div>
													{/* Scanning overlay */}
													<div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-[scan_1.5s_ease-in-out_infinite]" />
												</div>

												{/* Label */}
												<div
													className={cn(
														"text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center truncate",
														CLIP_LABEL_COLORS[card.label] ??
															"bg-muted text-muted-foreground",
													)}
												>
													{card.label}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Dica do especialista */}
							<div className="bg-muted/40 rounded-xl p-4 border border-border/50 relative overflow-hidden">
								<div className="absolute top-2 right-2 opacity-10">
									<Sparkles className="w-8 h-8 text-primary" />
								</div>
								<h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1">
									<Zap className="w-3 h-3 fill-current" /> Dica de Especialista
								</h4>
								<p
									className="text-xs leading-relaxed italic text-foreground/80"
									key={currentTipIndex}
								>
									&ldquo;{AI_TIPS[currentTipIndex]}&rdquo;
								</p>
							</div>

							{/* Indicador de etapas */}
							<div className="flex justify-center gap-2">
								{STATUS_MESSAGES.map((status, index) => (
									<div
										key={status.label}
										className={cn(
											"h-1.5 rounded-full transition-all duration-500",
											index < currentStatusIndex
												? "w-4 bg-primary"
												: index === currentStatusIndex
													? "w-4 bg-primary animate-pulse"
													: "w-1.5 bg-muted-foreground/20",
										)}
									/>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{isAnalyzing && (
				<div className="flex justify-center gap-6 text-muted-foreground opacity-50">
					{["Proteção de Dados", "IA de Alta Performance", "Qualidade 4K"].map(
						(label) => (
							<div key={label} className="flex items-center gap-1 text-[11px]">
								<CheckCircle2 className="w-3.5 h-3.5" /> {label}
							</div>
						),
					)}
				</div>
			)}

			<style jsx global>{`
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
      `}</style>
		</div>
	);
}
