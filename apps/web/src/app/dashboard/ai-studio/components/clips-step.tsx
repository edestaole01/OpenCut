"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	ArrowLeft,
	Share2,
	Search,
	SlidersHorizontal,
	Zap,
	Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
const VideoModal = dynamic(() =>
	import("./video-modal").then((m) => m.VideoModal),
);
const ExportPanel = dynamic(() =>
	import("./export-panel").then((m) => m.ExportPanel),
);
import { ClipCard } from "./clip-card";
import { TranscriptSection } from "./transcript-section";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { useRouter } from "next/navigation";
import { EditorCore } from "@/core";
import { toast } from "sonner";
import { processMediaAssets } from "@/lib/media/processing";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { getVideoInfo } from "@/lib/media/mediabunny";
import { transcriptionService } from "@/services/transcription/service";
import {
	isDemoTranscript,
	isAudioCueOnlyTranscript,
	isMissingSpecificTranscript,
	sanitizeCaptionText,
	extractClipTranscript,
	getClipTranscriptSegments,
	parseTimestampedTranscriptSegments,
	wrapCaptionText,
	formatTime,
} from "../utils/transcript-utils";
import type { TranscriptionResult } from "@/types/transcription";
import { videoCache } from "@/services/video-cache/service";

// Cache in-memory para blobs de vídeo já baixados por URL
const videoFileCache = new Map<string, File>();

/**
 * Strip hashtags, emojis, URLs and marketing noise from caption text
 * before matching against transcript segments.
 * Mirrors extractSpokenWords() on the server side.
 */
function extractSpokenWords(caption: string): string[] {
	return caption
		.replace(/#\w+/g, " ")
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 3);
}

/**
 * Mirror of the server-side alignClipsWithTranscript (route.ts).
 * Corrects a clip's start/end using TEXTUAL match only (no temporal snap).
 *
 * Match threshold: >= 30% of the caption words must appear in the segment.
 *
 * Asymmetric correction:
 * - clip starts > 3s BEFORE matched segment → correct (video before speech)
 * - clip starts > 8s AFTER matched segment → correct (AI placed it too late)
 * - Otherwise → keep AI's original timing.
 *
 * Applied on fresh analysis and when loading from history.
 */
function alignClipsWithTranscriptClient(
	clips: Clip[],
	segments: Array<{ start: number; end: number; text: string }>,
): Clip[] {
	const MIN_MATCH_RATIO = 0.25;
	const MIN_WORD_MATCHES = 2;
	const TEMPORAL_BUFFER = 2.0; // seconds

	if (segments.length === 0 || clips.length === 0) return clips;

	return clips.map((clip) => {
		const clipStart = parseClipTime(clip.start);
		const clipEnd = parseClipTime(clip.end);
		const words = extractSpokenWords(clip.caption || "");

		// Find segments that overlap temporally OR have significant text matching
		const relevantSegments = segments.filter((seg) => {
			// 1. Temporal overlap check
			const overlap =
				Math.min(seg.end, clipEnd + TEMPORAL_BUFFER) -
				Math.max(seg.start, clipStart - TEMPORAL_BUFFER);
			const hasTemporalOverlap = overlap > 0.5;

			// 2. Textual overlap check
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

			// Logic: Start at the first TEXTUAL match, end at the last RELEVANT segment
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

			// Smart padding: 150ms pre-roll, 300ms post-roll
			const paddedStart = Math.max(0, foundStart - 0.15);
			const paddedEnd = foundEnd + 0.3;

			const originalDuration = clipEnd - clipStart;
			const newDuration = paddedEnd - paddedStart;

			// Sanity check
			const isSane =
				(newDuration <= originalDuration * 2.5 || originalDuration < 15) &&
				newDuration >= originalDuration * 0.2;

			if (isSane) {
				return { ...clip, start: paddedStart, end: paddedEnd };
			}
		}
		return clip;
	});
}

function parseClipTime(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		// remove brackets and spaces
		const v = value.replace(/[[\]]/g, "").trim();
		if (v.includes(":")) {
			const parts = v.split(":").map((p) => Number(p));
			if (parts.every((p) => !Number.isNaN(p))) {
				if (parts.length === 3) {
					// HH:MM:SS
					return parts[0] * 3600 + parts[1] * 60 + parts[2];
				}
				if (parts.length === 2) {
					// MM:SS
					return parts[0] * 60 + parts[1];
				}
			}
		}
		const num = Number(v);
		if (Number.isFinite(num)) return num;
	}
	return 0;
}

type ClipElement = {
	id: string;
	type: "video";
	mediaId: string;
	name: string;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
	opacity?: number;
	sourceDuration?: number;
	muted?: boolean;
	hidden?: boolean;
	transform?: {
		position: { x: number; y: number };
		scale: number;
		rotate: number;
	};
	background?: {
		enabled: boolean;
		color: string;
		cornerRadius: number;
		paddingX: number;
		paddingY: number;
	};
	textAlign?: "center";
	fontFamily?: string;
	color?: string;
	fontSize?: number;
	fontWeight?: string;
	shadow?: {
		enabled: boolean;
		color: string;
		blur: number;
		offsetX: number;
		offsetY: number;
	};
};

type ClipTrack = {
	id: string;
	type: "video";
	elements: ClipElement[];
	isMain?: boolean;
	muted?: boolean;
	hidden?: boolean;
};

type MediaAsset = { id: string; file: File; type: "video" };

type TextElement = {
	type: "text";
	name: string;
	content: string;
	startTime: number;
	duration: number;
	hidden?: boolean;
	fontSize?: number;
	fontFamily?: string;
	color?: string;
	textAlign?: "center";
	fontWeight?: string;
	transform?: {
		position: { x: number; y: number };
		scale: number;
		rotate: number;
	};
	shadow?: {
		enabled: boolean;
		color: string;
		blur: number;
		offsetX: number;
		offsetY: number;
	};
	background?: {
		enabled: boolean;
		color: string;
		cornerRadius: number;
		paddingX: number;
		paddingY: number;
	};
};

type InsertableElement = {
	placement:
		| { mode: "auto"; trackType: "video" }
		| { mode: "explicit"; trackId: string };
	element: ClipElement | TextElement;
};

interface Clip {
	id: string;
	title: string;
	start: number;
	end: number;
	score: number;
	tag: string;
	caption: string;
}

const normalizeClips = (raw: Clip[]): Clip[] =>
	raw.map((clip, index) => {
		const start = parseClipTime(clip.start);
		const rawEnd = parseClipTime(clip.end);
		const duration = Math.max(0.1, rawEnd - start);
		// Only enforce 25s minimum when the AI returned a suspiciously short clip (< 5s),
		// which is almost certainly an error. Intentional clips between 5-24s are kept as-is.
		const minDuration = duration < 5 ? 25 : duration;
		const end = start + minDuration;
		const uniqueId = `${clip.id ?? index + 1}-${start}-${end}`;
		return {
			...clip,
			id: uniqueId,
			start,
			end,
		};
	});

interface ClipsStepProps {
	clips: Clip[];
	videoFile: File | null;
	videoUrl?: string;
	transcript?: string;
	transcriptSource?: string;
	language?: string;
	initialWords?: any[];
	isMock?: boolean;
	onBack: () => void;
	onPublish: () => void;
	onRequestVideoReupload?: (clip: Clip) => void;
}

const ALL_TAGS = ["Todos", "Gancho", "Tutorial", "Story", "Dica", "CTA"];
const CAPTION_PREFILL_STORAGE_KEY = "opencut:captions-prefill";
const VIDEO_DOWNLOAD_TIMEOUT_MS = 12000;

interface CaptionPrefillPayload {
	platform: string;
	clipTitle: string;
	clipCaption?: string;
	transcript?: string;
	score?: number;
	source: "ai-studio";
	createdAt: string;
}

async function transcribeClipAudio({
	videoFile,
	clip,
	forceLocal = false,
}: {
	videoFile: File;
	clip: Clip;
	forceLocal?: boolean;
}): Promise<TranscriptionResult | null> {
	try {
		const clipStart = parseClipTime(clip.start);
		let clipEnd = parseClipTime(clip.end);
		let videoDuration = clipEnd + 30; // safe fallback if metadata fails

		try {
			const info = await getVideoInfo({ videoFile });
			if (Number.isFinite(info.duration) && info.duration > 0) {
				videoDuration = info.duration;
				// Clamp clipEnd to actual video duration to avoid extracting beyond EOF
				if (clipEnd > videoDuration) {
					console.warn(
						`[transcribeClipAudio] clipEnd (${clipEnd}s) exceeds videoDuration (${videoDuration}s) — clamping`,
					);
					clipEnd = videoDuration;
				}
			}
		} catch (err) {
			console.warn(
				"Could not read video duration for transcription trimEnd:",
				err,
			);
		}

		const clipDuration = Math.max(0.6, clipEnd - clipStart);
		const trimEnd = Math.max(0, videoDuration - clipEnd);
		const audioBlob = await extractTimelineAudio({
			tracks: [
				{
					id: "clip-track",
					type: "video",
					elements: [
						{
							id: "clip-el",
							type: "video",
							mediaId: "m1",
							name: clip.title,
							startTime: 0,
							duration: clipDuration,
							trimStart: clipStart,
							trimEnd,
						},
					],
					isMain: true,
					muted: false,
					hidden: false,
				} satisfies ClipTrack,
			],
			mediaAssets: [
				{ id: "m1", file: videoFile, type: "video" } satisfies MediaAsset,
			],
			totalDuration: clipDuration,
		});

		const { samples, sampleRate } = await decodeAudioToFloat32({ audioBlob });
		const tryRemote = async () =>
			transcriptionService.transcribe({
				audioData: audioBlob,
				samples: samples,
				useRemote: true,
				sampleRate,
			});
		const tryLocal = async () =>
			transcriptionService.transcribe({
				audioData: samples,
				useRemote: false,
				sampleRate,
			});

		if (forceLocal) {
			try {
				return await tryLocal();
			} catch (err) {
				console.error("Forced local per-clip transcription failed:", err);
				return null;
			}
		}

		try {
			return await tryRemote();
		} catch (remoteErr) {
			console.warn(
				"Remote per-clip transcription failed, forcing local:",
				remoteErr,
			);
			try {
				return await tryLocal();
			} catch (localErr) {
				console.error("Local per-clip transcription also failed:", localErr);
				return null;
			}
		}
	} catch (error) {
		console.warn("Per-clip transcription failed", error);
		return null;
	}
}

export function ClipsStep({
	clips: initialClips,
	videoFile,
	videoUrl: initialVideoUrl,
	transcript,
	transcriptSource,
	language = "pt",
	initialWords,
	isMock = false,
	onBack,
	onPublish,
	onRequestVideoReupload,
}: ClipsStepProps) {
	const router = useRouter();
	const setActiveAssetsTab = useAssetsPanelStore((state) => state.setActiveTab);

	// 1. Estados
	const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null);
	const [clips, setClips] = useState(() => {
		const normalized = normalizeClips(initialClips);
		if (!transcript) return normalized;
		const segments = parseTimestampedTranscriptSegments(transcript);
		return alignClipsWithTranscriptClient(normalized, segments);
	});
	const [selectedClips, setSelectedClips] = useState<string[]>(() => clips.map((c) => c.id));
	const [showTranscript, setShowTranscript] = useState(false);
	const [activeClip, setActiveClip] = useState<Clip | null>(null);
	const [refinedTranscripts, setRefinedTranscripts] = useState<Record<string, WordMetadata[]>>({});
	const [isRefining, setIsRefining] = useState<string | null>(null);
	const [exportClip, setExportClip] = useState<Clip | null>(null);
	const [exportVideoFile, setExportVideoFile] = useState<File | null>(null);
	const [isResolving, setIsResolving] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [activeTag, setActiveTag] = useState("Todos");
	const [sortBy, setSortBy] = useState<"score" | "start">("score");
	const [editableTranscript, setEditableTranscript] = useState(
		isAudioCueOnlyTranscript(transcript || "") ? "" : transcript || "",
	);
	const [isEditingTranscript, setIsEditingTranscript] = useState(false);
	const transcriptIsDemo = useMemo(
		() =>
			isMock ||
			transcriptSource === "demo" ||
			isDemoTranscript(transcript || ""),
		[isMock, transcriptSource, transcript],
	);

	// 2. Memos
	const originalClipByTitle = useMemo(() => {
		const map = new Map<string, Clip>();
		for (const clip of normalizeClips(initialClips)) {
			map.set(clip.title, clip);
		}
		return map;
	}, [initialClips]);

	const clipById = useMemo(() => {
		const map = new Map<string, Clip>();
		for (const clip of clips) {
			map.set(clip.id, clip);
		}
		return map;
	}, [clips]);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const baseTranscript = (editableTranscript || transcript || "").toLowerCase();

		const matchesSearch = (clip: Clip) => {
			if (!term) return true;
			return (
				clip.title.toLowerCase().includes(term) ||
				(clip.caption || "").toLowerCase().includes(term) ||
				baseTranscript.includes(term)
			);
		};

		const byTag = (clip: Clip) =>
			activeTag === "Todos" || clip.tag === activeTag;

		const sorted = [...clips]
			.filter(byTag)
			.filter(matchesSearch)
			.sort((a, b) =>
				sortBy === "score" ? b.score - a.score : a.start - b.start,
			);

		return sorted;
	}, [activeTag, clips, editableTranscript, search, sortBy, transcript]);

	// 3. Callbacks Base (resolveSourceVideoFile deve vir ANTES de quem a usa)
	const resolveSourceVideoFile = useCallback(async (): Promise<File | null> => {
		const cacheKey = videoUrl ?? "in-memory-video-file";
		if (videoFileCache.has(cacheKey)) {
			return videoFileCache.get(cacheKey) ?? null;
		}

		if (videoUrl && !videoUrl.startsWith("blob:")) {
			try {
				const urlObj = videoUrl.startsWith("http")
					? new URL(videoUrl)
					: new URL(videoUrl, window.location.origin);
				const pathForApi = `${urlObj.pathname}${urlObj.search}`;
				const apiUrl = `/api/ai-studio/file?path=${encodeURIComponent(pathForApi)}`;
				const controller = new AbortController();
				const timeout = window.setTimeout(
					() => controller.abort(),
					VIDEO_DOWNLOAD_TIMEOUT_MS,
				);
				const response = await fetch(apiUrl, { signal: controller.signal });
				window.clearTimeout(timeout);
				if (response.ok) {
					const blob = await response.blob();
					const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
					const file = new File([blob], decodeURIComponent(rawName), {
						type: blob.type || "video/mp4",
					});
					videoFileCache.set(cacheKey, file);
					return file;
				}
			} catch (error) {
				console.warn("Could not resolve video file from API route:", error);
			}
		}

		if (videoUrl?.startsWith("blob:")) {
			try {
				const response = await fetch(videoUrl);
				if (response.ok) {
					const blob = await response.blob();
					const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
					const file = new File([blob], decodeURIComponent(rawName), {
						type: blob.type || "video/mp4",
					});
					videoFileCache.set(cacheKey, file);
					return file;
				}
			} catch (error) {
				console.warn("Could not resolve blob URL:", error);
			}
		}

		if (videoFile) {
			videoFileCache.set(cacheKey, videoFile);
			return videoFile;
		}

		return null;
	}, [videoFile, videoUrl]);

	const resolveClipForAction = useCallback(
		(clip: Clip) => {
			const normalizedStart = parseClipTime(clip.start);
			const normalizedEnd = parseClipTime(clip.end);
			const byId = clipById.get(clip.id);
			if (byId && byId.start === normalizedStart && byId.end === normalizedEnd) {
				return byId;
			}
			const byTime = clips.find((c) => c.start === normalizedStart && c.end === normalizedEnd);
			return byTime ?? byId ?? { ...clip, start: normalizedStart, end: normalizedEnd };
		},
		[clipById, clips],
	);

	// 4. Callbacks de Ação
	const handleRefineCaptions = useCallback(async (clip: Clip) => {
		if (!videoUrl) {
			toast.error("Vídeo não encontrado para refinar legendas.");
			return;
		}

		setIsRefining(clip.id);
		const toastId = toast.loading(`Refinando legendas palavra por palavra para "${clip.title}"...`);

		try {
			const sourceVideoFile = await resolveSourceVideoFile();
			if (!sourceVideoFile) throw new Error("Vídeo original não encontrado");

			// USE THE TRUE WORD-LEVEL ENGINE (WHISPER)
			const transcription = await transcribeClipAudio({
				videoFile: sourceVideoFile,
				clip: clip
			});

			if (!transcription || !transcription.segments) {
				throw new Error("Falha na transcrição de alta precisão");
			}

			// Map Whisper segments/words to our OPE WordMetadata
			// We need to shift the times back to the ABSOLUTE video time
			// because transcribeClipAudio transcribes the slice [0, clipDuration]
			const clipStart = parseClipTime(clip.start);
			const allWords: WordMetadata[] = [];

			transcription.segments.forEach((seg, sIdx) => {
				if (seg.words && seg.words.length > 0) {
					// Use word-level timestamps if available (Whisper V3)
					seg.words.forEach((w, wIdx) => {
						allWords.push({
							id: `word-${clip.id}-${sIdx}-${wIdx}`,
							text: w.word.trim(),
							start: clipStart + w.start,
							end: clipStart + w.end,
							confidence: 1,
							isPunctuation: false
						});
					});
				} else {
					// Fallback to segment-level if words are missing
					allWords.push({
						id: `word-${clip.id}-${sIdx}`,
						text: seg.text.trim(),
						start: clipStart + seg.start,
						end: clipStart + seg.end,
						confidence: 1,
						isPunctuation: false
					});
				}
			});

			if (allWords.length === 0) throw new Error("Nenhuma palavra detectada");

			setRefinedTranscripts(prev => ({
				...prev,
				[clip.id]: allWords
			}));

			toast.success("Sincronia palavra-por-palavra aplicada!", { id: toastId });
		} catch (error) {
			console.error("Refinement error:", error);
			toast.error("Erro ao refinar. Tente novamente.", { id: toastId });
		} finally {
			setIsRefining(null);
		}
	}, [videoUrl, resolveSourceVideoFile]);

	const handleExportClip = useCallback(
		async (clip: Clip) => {
			setIsResolving(clip.id);
			const sourceVideoFile = await resolveSourceVideoFile();
			setIsResolving(null);
			if (!sourceVideoFile) {
				if (onRequestVideoReupload) {
					onRequestVideoReupload(clip);
					toast.info("Por favor, reconecte o vÃ­deo original para exportar.");
				} else {
					toast.error(
						"VÃ­deo original nÃ£o disponÃ­vel. Tente reenviar o arquivo.",
					);
				}
				return;
			}
			setExportVideoFile(sourceVideoFile);
			setExportClip(clip);
		},
		[resolveSourceVideoFile, onRequestVideoReupload],
	);

	const handleOpenCaptionGenerator = useCallback(
		(clip: Clip) => {
			let transcriptForCaption = "";
			const transcriptSeed = editableTranscript.trim();
			const clipStart = parseClipTime(clip.start);
			const clipEnd = parseClipTime(clip.end);

			if (transcriptSeed && !isDemoTranscript(transcriptSeed)) {
				const extracted = extractClipTranscript(
					transcriptSeed,
					clipStart,
					clipEnd,
				);
				if (extracted && !isMissingSpecificTranscript(extracted)) {
					transcriptForCaption = sanitizeCaptionText(extracted);
				}
			}
			const payload: CaptionPrefillPayload = {
				source: "ai-studio",
				createdAt: new Date().toISOString(),
				platform: "instagram",
				clipTitle: clip.title,
				clipCaption: clip.caption || undefined,
				transcript: transcriptForCaption || undefined,
				score: Number.isFinite(clip.score) ? clip.score : undefined,
			};
			if (typeof window !== "undefined") {
				window.sessionStorage.setItem(
					CAPTION_PREFILL_STORAGE_KEY,
					JSON.stringify(payload),
				);
			}
			router.push("/dashboard/captions");
		},
		[editableTranscript, router],
	);

	const handleNudgeStart = useCallback((clip: Clip, delta: number) => {
		setClips((prev) =>
			prev.map((c) => {
				if (c.id !== clip.id) return c;
				const newStart = Math.max(0, c.start + delta);
				// Prevent start from exceeding end - 0.5s
				const safeStart = Math.min(newStart, c.end - 0.5);
				return { ...c, start: safeStart };
			}),
		);
	}, []);

	const handleNudgeEnd = useCallback((clip: Clip, delta: number) => {
		setClips((prev) =>
			prev.map((c) => {
				if (c.id !== clip.id) return c;
				const newEnd = Math.max(c.start + 0.5, c.end + delta);
				return { ...c, end: newEnd };
			}),
		);
	}, []);

	const handleRestoreClip = useCallback(
		(clip: Clip) => {
			const original = originalClipByTitle.get(clip.title);
			if (!original) {
				toast.info("Não encontrei o tempo original para este clip.");
				return;
			}
			setClips((prev) =>
				prev.map((c) =>
					c.id === clip.id
						? { ...c, start: original.start, end: original.end }
						: c,
				),
			);
			toast.success(
				`Clip restaurado para ${formatTime(original.start)} -> ${formatTime(original.end)}.`,
			);
		},
		[originalClipByTitle],
	);

	const handleSnapToTranscript = useCallback(
		(clip: Clip) => {
			const baseTranscript = (transcript || "").trim();
			if (!baseTranscript) {
				toast.info("Sem transcrição para ajustar este corte.");
				return;
			}
			const windowStart = Math.max(0, parseClipTime(clip.start) - 3);
			const windowEnd = parseClipTime(clip.end) + 3;
			const segments = getClipTranscriptSegments(
				baseTranscript,
				windowStart,
				windowEnd,
			);
			if (segments.length === 0) {
				toast.info(
					"Nenhum timestamp encontrado na transcrição para este corte.",
				);
				return;
			}
			const targetStart = segments[0].start;
			const originalDuration = parseClipTime(clip.end) - parseClipTime(clip.start);
			// Last segment may have end=Infinity — use original clip duration as fallback
			const rawEnd = segments[segments.length - 1].end;
			const targetEnd = Number.isFinite(rawEnd)
				? rawEnd
				: targetStart + originalDuration;

			setClips((prev) =>
				prev.map((c) =>
					c.id === clip.id ? { ...c, start: targetStart, end: targetEnd } : c,
				),
			);
			toast.success(
				`Corte ajustado pelos timestamps: ${formatTime(targetStart)} -> ${formatTime(targetEnd)}`,
			);
		},
		[transcript],
	);

	const handleRemoveSilences = useCallback(
		(clip: Clip) => {
			const baseTranscript = (transcript || "").trim();
			if (!baseTranscript) {
				toast.info("Sem transcrição para remover silêncios.");
				return;
			}
			const segments = getClipTranscriptSegments(
				baseTranscript,
				parseClipTime(clip.start),
				parseClipTime(clip.end),
			);
			if (segments.length < 2) {
				toast.info("Poucos segmentos de fala para detectar silêncios.");
				return;
			}

			let totalRemoved = 0;
			const newSegments = [...segments];

			// Snap segments together if gap > 0.5s
			for (let i = 0; i < newSegments.length - 1; i++) {
				const current = newSegments[i];
				const next = newSegments[i + 1];
				const gap = next.start - current.end;

				if (gap > 0.4) {
					// 400ms buffer
					const reduction = gap - 0.1; // leave 100ms of natural gap
					totalRemoved += reduction;

					// Shift all subsequent segments
					for (let j = i + 1; j < newSegments.length; j++) {
						newSegments[j].start -= reduction;
						newSegments[j].end -= reduction;
					}
				}
			}

			if (totalRemoved <= 0.1) {
				toast.info("Não detectamos silêncios significativos neste trecho.");
				return;
			}

			const targetStart = newSegments[0].start;
			const targetEnd = newSegments[newSegments.length - 1].end;

			setClips((prev) =>
				prev.map((c) =>
					c.id === clip.id ? { ...c, start: targetStart, end: targetEnd } : c,
				),
			);

			toast.success(
				`Silêncios removidos! Cortamos ${totalRemoved.toFixed(1)}s de pausas vazias.`,
			);
		},
		[transcript],
	);

	const toggleClip = useCallback(
		(id: string) => {
			setSelectedClips((prev) =>
				prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
			);
		},
		[],
	);

	const removeClip = useCallback(
		(id: string) => {
			setClips((prev) => prev.filter((c) => c.id !== id));
			setSelectedClips((prev) => prev.filter((c) => c !== id));
			setActiveClip((prev) => (prev?.id === id ? null : prev));
		},
		[],
	);

	const handleGlobalCalibrate = useCallback((clip: Clip, actualStartTime: number) => {
		const drift = actualStartTime - clip.start;
		if (Math.abs(drift) < 0.1) return;

		setClips((prev) => prev.map(c => ({
			...c,
			start: Number((c.start + drift).toFixed(2)),
			end: Number((c.end + drift).toFixed(2))
		})));

		// Also shift any refined transcripts already cached
		setRefinedTranscripts((prev) => {
			const updated: Record<string, WordMetadata[]> = {};
			for (const id in prev) {
				updated[id] = prev[id].map(w => ({
					...w,
					start: Number((w.start + drift).toFixed(2)),
					end: Number((w.end + drift).toFixed(2))
				}));
			}
			return updated;
		});

		toast.success(`Sincronia global ajustada em ${drift > 0 ? "+" : ""}${drift.toFixed(1)}s!`);
	}, []);

	const handleEditInTimeline = useCallback(
		async (clip: Clip) => {
			const targetClip = resolveClipForAction(clip);
			const clipStart = parseClipTime(targetClip.start);
			const clipEnd = parseClipTime(targetClip.end);

			if (!Number.isFinite(clipStart) || !Number.isFinite(clipEnd)) {
				toast.error("Clip sem tempos válidos para abrir no editor.");
				return;
			}

			console.log("[ClipsStep] handleEditInTimeline", {
				cardClip: clip,
				resolvedClip: targetClip,
				parsedStart: clipStart,
				parsedEnd: clipEnd,
				videoUrl,
			});

			setIsResolving(targetClip.id);
			videoCache.clearAll(); // evita usar quadros cacheados de outro clipe
			if (videoUrl) {
				videoFileCache.delete(videoUrl); // força refetch para este clip
			}
			const sourceVideoFile = await resolveSourceVideoFile();
			if (!sourceVideoFile) {
				setIsResolving(null);
				if (onRequestVideoReupload) {
					onRequestVideoReupload(targetClip);
					toast.info("Por favor, reconecte o vídeo original para editar.");
				} else {
					toast.error(
						"Não foi possível carregar o vídeo original deste projeto.",
					);
				}
				return;
			}
			const toastId = toast.loading("Preparando editor...");
			try {
				EditorCore.reset();
				const editor = EditorCore.getInstance();

				let perClipResult = await transcribeClipAudio({
					videoFile: sourceVideoFile,
					clip: targetClip,
				});

				if (!perClipResult) {
					console.warn(
						"[ClipsStep] per-clip transcription null, retrying local only",
					);
					perClipResult = await transcribeClipAudio({
						videoFile: sourceVideoFile,
						clip: targetClip,
						forceLocal: true,
					});
				}

				const projectId = await editor.project.createNewProject({
					name: `Clip: ${targetClip.title}`,
					settings: { canvasSize: { width: 1080, height: 1920 } },
				});

				const [processedAsset] = await processMediaAssets({
					files: [sourceVideoFile],
				});
				if (!processedAsset)
					throw new Error(
						"Falha ao processar o arquivo de vídeo para timeline",
					);

				console.log("[ClipsStep] processedAsset", {
					duration: processedAsset.duration,
					width:
						"width" in processedAsset
							? (processedAsset as { width?: number }).width
							: undefined,
					height:
						"height" in processedAsset
							? (processedAsset as { height?: number }).height
							: undefined,
				});

				const assetId = await editor.media.addMediaAsset({
					projectId,
					asset: processedAsset,
				});

				const sourceDuration =
					typeof processedAsset.duration === "number" &&
					processedAsset.duration > 0
						? processedAsset.duration
						: clipEnd + 30;

				// Clamp clipEnd to actual source duration to avoid trimEnd going negative.
				const safeClipEnd = Math.min(clipEnd, sourceDuration);
				const clipDuration = Math.max(0.1, safeClipEnd - clipStart);
				const trimEnd = Math.max(0, sourceDuration - safeClipEnd);

				console.log("[ClipsStep] timeline timings", {
					clipStart,
					clipEnd,
					clipDuration,
					sourceDuration,
					trimEnd,
				});

				const videoElement: ClipElement = {
					type: "video",
					mediaId: assetId,
					name: targetClip.title,
					startTime: 0,
					trimStart: clipStart,
					trimEnd: trimEnd,
					duration: clipDuration,
					sourceDuration,
					transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
					opacity: 1,
					muted: false,
					hidden: false,
				};

				let clipTranscriptSegments: Array<{
					startTime: number;
					duration: number;
					content: string;
				}> = [];
				let finalTranscriptText = "";

				if (perClipResult?.segments && perClipResult.segments.length > 0) {
					finalTranscriptText = perClipResult.text;
					for (const segment of perClipResult.segments) {
						if (segment.words && segment.words.length > 0) {
							const wordsPerChunk = 3;
							for (let i = 0; i < segment.words.length; i += wordsPerChunk) {
								const chunkWords = segment.words.slice(i, i + wordsPerChunk);
								const content = wrapCaptionText(
									chunkWords.map((w) => w.word).join(" "),
									18,
								);
								const startTime = Math.max(0, chunkWords[0].start - clipStart);
								const duration = Math.max(
									0.6,
									Math.min(
										clipDuration,
										chunkWords[chunkWords.length - 1].end - chunkWords[0].start,
									),
								);
								clipTranscriptSegments.push({ startTime, duration, content });
							}
						} else {
							clipTranscriptSegments.push({
								startTime: Math.max(0, segment.start - clipStart),
								duration: Math.max(
									0.8,
									Math.min(clipDuration, segment.end - segment.start),
								),
								content: wrapCaptionText(segment.text, 18),
							});
						}
					}
				} else {
					// Fallback 1: global transcript with timestamp segments
					const cleanedGlobal = (transcript || "").trim();
					if (cleanedGlobal && !isDemoTranscript(cleanedGlobal)) {
						const relevantSegments = getClipTranscriptSegments(
							cleanedGlobal,
							clipStart,
							safeClipEnd,
						);
						if (relevantSegments.length > 0) {
							clipTranscriptSegments = relevantSegments.map((s) => {
								// Use the intersection of the segment with the clip window
								// to get the correct duration relative to the clip.
								const segStart = Math.max(s.start, clipStart);
								const segEnd = Math.min(
									Number.isFinite(s.end) ? s.end : safeClipEnd,
									safeClipEnd,
								);
								const intersectionDuration = Math.max(0.8, segEnd - segStart);
								return {
									startTime: Math.max(0, s.start - clipStart),
									duration: Math.min(intersectionDuration, clipDuration),
									content: wrapCaptionText(s.text, 18),
								};
							});
							finalTranscriptText = relevantSegments.map((s) => s.text).join(" ");
						}
					}

					// Fallback 2: per-clip transcription text without segments
					if (clipTranscriptSegments.length === 0 && perClipResult?.text?.trim()) {
						finalTranscriptText = perClipResult.text.trim();
						clipTranscriptSegments = [
							{
								startTime: 0,
								duration: clipDuration,
								content: wrapCaptionText(finalTranscriptText, 18),
							},
						];
					}

					// Fallback 3: clip caption text
					if (clipTranscriptSegments.length === 0 && targetClip.caption?.trim()) {
						finalTranscriptText = targetClip.caption.trim();
						clipTranscriptSegments = [
							{
								startTime: 0,
								duration: clipDuration,
								content: wrapCaptionText(finalTranscriptText, 18),
							},
						];
					}

					if (clipTranscriptSegments.length === 0) {
						console.warn(
							"[ClipsStep] No transcription available for this clip; captions will not be added",
						);
					}
				}

				console.log("[ClipsStep] transcript source", {
					hasPerClip: Boolean(perClipResult?.segments?.length),
					hasGlobalTranscript: Boolean((transcript || "").trim()),
					segmentsCount: clipTranscriptSegments.length,
					finalTranscriptTextPreview: finalTranscriptText.slice(0, 120),
					offsetAppliedSeconds: clipStart,
				});

				// Garante pelo menos uma legenda se houver texto final
				if (clipTranscriptSegments.length === 0 && finalTranscriptText) {
					clipTranscriptSegments = [
						{
							startTime: 0,
							duration: clipDuration,
							content: wrapCaptionText(finalTranscriptText, 18),
						},
					];
				}

				const elementsToInsert: InsertableElement[] = [
					{
						placement: { mode: "auto", trackType: "video" },
						element: videoElement,
					},
				];

				if (clipTranscriptSegments.length > 0) {
					const captionsTrackId = editor.timeline.addTrack({ type: "text" });
					for (const segment of clipTranscriptSegments) {
						elementsToInsert.push({
							placement: { mode: "explicit", trackId: captionsTrackId },
							element: {
								type: "text",
								name: "Caption",
								content: segment.content.toUpperCase(),
								startTime: segment.startTime,
								duration: segment.duration,
								fontSize: 4.5,
								fontFamily: "Inter",
								color: "#ffffff",
								textAlign: "center",
								fontWeight: "900",
								// y: 480 = canvasCenter.y (960) + 480 = 1440px → 75% of 1920px portrait height
								transform: { position: { x: 0, y: 480 }, scale: 1, rotate: 0 },
								shadow: {
									enabled: true,
									color: "rgba(0,0,0,0.8)",
									blur: 4,
									offsetX: 2,
									offsetY: 2,
								},
								background: {
									enabled: true,
									color: "rgba(0,0,0,0.85)",
									cornerRadius: 8,
									paddingX: 30,
									paddingY: 15,
								},
							},
						});
					}
				}

				editor.timeline.insertElements({ elements: elementsToInsert });
				await editor.project.saveCurrentProject();

				if (typeof window !== "undefined" && finalTranscriptText) {
					window.sessionStorage.setItem(
						`opencut:project-transcript:${projectId}`,
						finalTranscriptText,
					);
				}

				toast.success("Clip aberto no editor!", { id: toastId });
				setActiveAssetsTab("captions");
				setIsResolving(null);
				router.push(`/editor/${projectId}`);
			} catch (err) {
				console.error("Erro ao abrir no editor:", err);
				setIsResolving(null);
				toast.error("Não foi possível abrir o editor.", { id: toastId });
			}
		},
		[
			resolveSourceVideoFile,
			onRequestVideoReupload,
			transcript,
			setActiveAssetsTab,
			router,
			videoUrl,
			resolveClipForAction,
		],
	);

	const handleDiscardTranscript = useCallback(() => {
		setEditableTranscript(transcript || "");
		setIsEditingTranscript(false);
	}, [transcript]);

	const handleSaveTranscript = useCallback(() => {
		setIsEditingTranscript(false);
		toast.success("TranscriÃ§Ã£o atualizada localmente!");
	}, []);

	return (
		<div className="space-y-5">
			{activeClip && videoUrl && (
				<VideoModal
					clip={activeClip}
					videoUrl={videoUrl}
					transcript={
						refinedTranscripts[activeClip.id] || 
						(initialWords && initialWords.length > 0 
							? initialWords.filter(w => 
								w.start >= activeClip.start - 2 && 
								w.end <= activeClip.end + 2
							  ) 
							: transcript)
					}
					onClose={() => setActiveClip(null)}
					onCalibrate={handleGlobalCalibrate}
				/>
			)}
			{exportClip && exportVideoFile && (
				<ExportPanel
					clip={exportClip}
					videoFile={exportVideoFile}
					onClose={() => {
						setExportClip(null);
						setExportVideoFile(null);
					}}
				/>
			)}

			{!videoFile && !videoUrl && onRequestVideoReupload && (
				<div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm animate-in slide-in-from-top-2 duration-500 shadow-sm">
					<div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
						<Zap className="w-5 h-5 text-primary" />
					</div>
					<div className="flex-1 space-y-0.5">
						<p className="font-semibold text-foreground">
							Reconecte seu vÃ­deo para editar
						</p>
						<p className="text-muted-foreground text-xs">
							NÃ£o encontramos uma cÃ³pia local do vÃ­deo. Selecione o arquivo
							original para abrir na timeline ou exportar.
						</p>
					</div>
					<Button
						size="sm"
						className="shrink-0 gap-2"
						onClick={() => onRequestVideoReupload(clips[0])}
					>
						<Plus className="w-4 h-4" /> Selecionar Arquivo
					</Button>
				</div>
			)}

			{transcriptIsDemo && (
				<div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
					Esta anÃ¡lise estÃ¡ em modo demonstraÃ§Ã£o. O texto mostrado nÃ£o Ã© a
					transcriÃ§Ã£o real do vÃ­deo.
				</div>
			)}

			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold">
						{clips.length} clips encontrados
					</h2>
					<p className="text-muted-foreground text-sm">
						{selectedClips.length} selecionados
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={onBack}>
						<ArrowLeft className="w-4 h-4 mr-2" />
						Voltar
					</Button>
					<Button onClick={onPublish} disabled={selectedClips.length === 0}>
						<Share2 className="w-4 h-4 mr-2" />
						Publicar
					</Button>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							placeholder="Pesquisar clips, captions, tags..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() =>
							setSortBy((s) => (s === "score" ? "start" : "score"))
						}
						title={
							sortBy === "score" ? "Ordenar por tempo" : "Ordenar por score"
						}
					>
						<SlidersHorizontal className="w-4 h-4" />
					</Button>
				</div>

				<div className="flex gap-2 flex-wrap">
					{ALL_TAGS.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => setActiveTag(tag)}
							className={cn(
								"px-3 py-1 rounded-full text-xs font-medium border transition-colors",
								activeTag === tag
									? "bg-primary text-primary-foreground border-primary"
									: "border-border hover:bg-muted",
							)}
						>
							{tag}
						</button>
					))}
					<span className="text-xs text-muted-foreground self-center ml-auto">
						{sortBy === "score" ? "â†“ Maior score" : "â†“ CronolÃ³gico"}
					</span>
				</div>
			</div>

			<TranscriptSection
				transcript={editableTranscript}
				isEditing={isEditingTranscript}
				isVisible={showTranscript}
				onToggleVisible={() => setShowTranscript((v) => !v)}
				onToggleEditing={() => setIsEditingTranscript((v) => !v)}
				onChange={setEditableTranscript}
				onDiscard={handleDiscardTranscript}
				onSave={handleSaveTranscript}
			/>

			{filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center gap-3">
					<Search className="w-10 h-10 text-muted-foreground/30" />
					<p className="text-muted-foreground">
						Nenhum clip encontrado para &ldquo;{search}&rdquo;
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setSearch("");
							setActiveTag("Todos");
						}}
					>
						Limpar filtros
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{filtered.map((clip) => (
						<ClipCard
							key={`${clip.id}-${clip.start}-${clip.end}`}
							clip={clip}
							isSelected={selectedClips.includes(clip.id)}
							isResolving={isResolving === clip.id}
							videoUrl={videoUrl}
							onToggle={toggleClip}
							onRemove={removeClip}
							onExpand={setActiveClip}
							onExport={handleExportClip}
							onPreview={setActiveClip}
							onNudgeStart={handleNudgeStart}
							onNudgeEnd={handleNudgeEnd}
							onRestore={handleRestoreClip}
							onSnapToTranscript={handleSnapToTranscript}
							onRemoveSilences={handleRemoveSilences}
							onRefine={handleRefineCaptions}
							isRefining={isRefining === clip.id}
							hasRefinedTranscript={!!refinedTranscripts[clip.id]}
							onEditInTimeline={handleEditInTimeline}
							onOpenCaptionGenerator={handleOpenCaptionGenerator}
						/>
					))}
				</div>
			)}
		</div>
	);
}
