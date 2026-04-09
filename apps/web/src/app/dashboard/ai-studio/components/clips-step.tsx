"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	ArrowLeft,
	Share2,
	Search,
	SlidersHorizontal,
	Maximize2,
	Clock,
	Star,
	Download,
	Sparkles,
	Film,
	Wrench,
	Activity,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAssetsPanelStore } from "@/stores/assets-panel";
import { cn } from "@/lib/utils";
import { ClipCard } from "./clip-card";
import { VideoModal } from "./video-modal";
import { ExportPanel } from "./export-panel";
import { TranscriptSection } from "./transcript-section";
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
import type { WordMetadata, Clip, ClipTrack, MediaAsset } from "@/core/engine/types";

// --- CONSTANTES E UTILITÁRIOS FORA DO COMPONENTE ---

const videoFileCache = new Map<string, File>();
const ALL_TAGS = ["Todos", "Gancho", "Tutorial", "Story", "Dica", "CTA"];
const VIDEO_DOWNLOAD_TIMEOUT_MS = 12000;

function parseClipTime(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const v = value.replace(/[\[\]]/g, "").trim();
		if (v.includes(":")) {
			const parts = v.split(":").map(Number);
			if (parts.length === 2) return parts[0] * 60 + parts[1];
			if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
		}
		const n = Number(v);
		if (Number.isFinite(n)) return n;
	}
	return 0;
}

function normalizeClips(clips: any[]): Clip[] {
	return clips.map((clip, index) => {
		const start = parseClipTime(clip.start);
		const rawEnd = parseClipTime(clip.end);
		const duration = Math.max(0.1, rawEnd - start);
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
}

function extractSpokenWords(caption: string): string[] {
	return caption
		.replace(/#\w+/g, " ")
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 3);
}

function alignClipsWithTranscriptClient(
	clips: Clip[],
	segments: Array<{ start: number; end: number; text: string }>,
): Clip[] {
	const MIN_MATCH_RATIO = 0.25;
	const MIN_WORD_MATCHES = 2;
	const TEMPORAL_BUFFER = 10.0;

	if (segments.length === 0 || clips.length === 0) return clips;

	return clips.map((clip) => {
		const clipStart = parseClipTime(clip.start);
		const clipEnd = parseClipTime(clip.end);
		const words = extractSpokenWords(clip.caption || "");

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

async function transcribeClipAudio({
	videoFile,
	clip,
	forceLocal = false,
}: {
	videoFile: File;
	clip: Clip;
	forceLocal?: boolean;
}): Promise<(TranscriptionResult & { contextBuffer: number }) | null> {
	try {
		const CONTEXT_BUFFER = 2.0;
		const rawStart = parseClipTime(clip.start);
		const rawEnd = parseClipTime(clip.end);
		const clipStart = Math.max(0, rawStart - CONTEXT_BUFFER);
		const actualBufferUsed = rawStart - clipStart;
		let videoDuration = rawEnd + 30;

		try {
			const info = await getVideoInfo({ videoFile });
			if (Number.isFinite(info.duration) && info.duration > 0) {
				videoDuration = info.duration;
			}
		} catch (err) {
			console.warn("Could not read video duration", err);
		}

		const clipEnd = Math.min(videoDuration, rawEnd + CONTEXT_BUFFER);
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
		const processResult = (res: TranscriptionResult) => ({
			...res,
			contextBuffer: actualBufferUsed,
		});

		const tryRemote = async () =>
			transcriptionService
				.transcribe({
					audioData: audioBlob,
					samples: samples,
					useRemote: true,
					sampleRate,
				})
				.then(processResult);

		const tryLocal = async () =>
			transcriptionService
				.transcribe({
					audioData: samples,
					useRemote: false,
					sampleRate,
				})
				.then(processResult);

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
			console.warn("Remote per-clip transcription failed, forcing local:", remoteErr);
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

// --- COMPONENTE PRINCIPAL ---

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

	// 1. ESTADOS (No topo do componente)
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

	// 2. MEMOS
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

		const byTag = (clip: Clip) => activeTag === "Todos" || clip.tag === activeTag;

		const sorted = [...clips]
			.filter(byTag)
			.filter(matchesSearch)
			.sort((a, b) => (sortBy === "score" ? b.score - a.score : a.start - b.start));

		return sorted;
	}, [activeTag, clips, editableTranscript, search, sortBy, transcript]);

	// 3. CALLBACKS BASE (Definidos antes de serem referenciados)
	const resolveSourceVideoFile = useCallback(async (): Promise<File | null> => {
		const cacheKey = videoUrl ?? "in-memory-video-file";
		if (videoFileCache.has(cacheKey)) return videoFileCache.get(cacheKey) ?? null;

		if (videoUrl && !videoUrl.startsWith("blob:")) {
			try {
				const urlObj = videoUrl.startsWith("http")
					? new URL(videoUrl)
					: new URL(videoUrl, window.location.origin);
				const pathForApi = `${urlObj.pathname}${urlObj.search}`;
				const apiUrl = `/api/ai-studio/file?path=${encodeURIComponent(pathForApi)}`;
				const controller = new AbortController();
				const timeout = window.setTimeout(() => controller.abort(), VIDEO_DOWNLOAD_TIMEOUT_MS);
				const response = await fetch(apiUrl, { signal: controller.signal });
				window.clearTimeout(timeout);
				if (response.ok) {
					const blob = await response.blob();
					const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
					const file = new File([blob], decodeURIComponent(rawName), { type: blob.type || "video/mp4" });
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
					const file = new File([blob], decodeURIComponent(rawName), { type: blob.type || "video/mp4" });
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
			if (byId && byId.start === normalizedStart && byId.end === normalizedEnd) return byId;
			const byTime = clips.find((c) => c.start === normalizedStart && c.end === normalizedEnd);
			return byTime ?? byId ?? { ...clip, start: normalizedStart, end: normalizedEnd };
		},
		[clipById, clips],
	);

	// 4. CALLBACKS DE AÇÃO
	const handleRefineCaptions = useCallback(
		async (clip: Clip) => {
			if (!videoUrl) {
				toast.error("Vídeo não encontrado para refinar legendas.");
				return;
			}

			setIsRefining(clip.id);
			const toastId = toast.loading(`Refinando legendas para "${clip.title}"...`);

			try {
				const sourceVideoFile = await resolveSourceVideoFile();
				if (!sourceVideoFile) throw new Error("Vídeo original não encontrado");

				const transcription = await transcribeClipAudio({ videoFile: sourceVideoFile, clip });
				if (!transcription || !transcription.segments) throw new Error("Falha na transcrição de alta precisão");

				const rawStart = parseClipTime(clip.start);
				const bufferAdjustment = transcription.contextBuffer ?? 0;
				const absoluteStartBase = rawStart - bufferAdjustment;
				const allWords: WordMetadata[] = [];

				transcription.segments.forEach((seg, sIdx) => {
					if (seg.words && seg.words.length > 0) {
						seg.words.forEach((w, wIdx) => {
							allWords.push({
								id: `word-${clip.id}-${sIdx}-${wIdx}`,
								text: w.word.trim(),
								start: absoluteStartBase + w.start,
								end: absoluteStartBase + w.end,
								confidence: 1,
								isPunctuation: false,
							});
						});
					} else {
						allWords.push({
							id: `word-${clip.id}-${sIdx}`,
							text: seg.text.trim(),
							start: absoluteStartBase + seg.start,
							end: absoluteStartBase + seg.end,
							confidence: 1,
							isPunctuation: false,
						});
					}
				});

				if (allWords.length === 0) throw new Error("Nenhuma palavra detectada");

				const firstSpokenWord = allWords.find((w) => w.text.length > 1);
				if (firstSpokenWord) {
					const drift = firstSpokenWord.start - rawStart;
					if (Math.abs(drift) < 3.0) {
						const healedStart = Math.max(0, firstSpokenWord.start - 0.15);
						const duration = clip.end - clip.start;
						setClips((prev) =>
							prev.map((c) => (c.id === clip.id ? { ...c, start: healedStart, end: healedStart + duration } : c)),
						);
					}
				}

				setRefinedTranscripts((prev) => ({ ...prev, [clip.id]: allWords }));
				toast.success("Sincronia HD aplicada!", { id: toastId });
			} catch (error) {
				console.error("Refinement error:", error);
				toast.error("Erro ao refinar. Tente novamente.", { id: toastId });
			} finally {
				setIsRefining(null);
			}
		},
		[videoUrl, language, resolveSourceVideoFile],
	);

	const handleExportClip = useCallback(
		async (clip: Clip) => {
			setIsResolving(clip.id);
			const sourceVideoFile = await resolveSourceVideoFile();
			setIsResolving(null);

			if (!sourceVideoFile) {
				if (!videoUrl) {
					toast.error("Você precisa enviar o vídeo original para exportar.");
				} else {
					toast.error("Vídeo original não disponível. Tente reenviar o arquivo.");
				}
				return;
			}
			setExportVideoFile(sourceVideoFile);
			setExportClip(clip);
		},
		[resolveSourceVideoFile, videoUrl],
	);

	const handleEditInTimeline = useCallback(
		async (clip: Clip) => {
			const targetClip = resolveClipForAction(clip);
			const clipStart = parseClipTime(targetClip.start);
			const clipEnd = parseClipTime(targetClip.end);
			const clipDuration = Math.max(0.5, clipEnd - clipStart);

			const toastId = toast.loading("Preparando editor...");
			try {
				const sourceVideoFile = await resolveSourceVideoFile();
				if (!sourceVideoFile) throw new Error("Vídeo original não encontrado");

				const perClipResult = await transcribeClipAudio({ videoFile: sourceVideoFile, clip: targetClip });
				const projectId = nanoid(); // nanoid import? Yes, adding below
				const sourceDuration = (await getVideoInfo({ videoFile: sourceVideoFile })).duration;
				const trimEnd = Math.max(0, sourceDuration - clipEnd);

				toast.success("Clip aberto no editor!", { id: toastId });
				router.push(`/editor/${projectId}`);
			} catch (err) {
				console.error("Erro ao abrir no editor:", err);
				toast.error("Não foi possível abrir o editor.", { id: toastId });
			}
		},
		[resolveSourceVideoFile, router, resolveClipForAction],
	);

	const handleGlobalCalibrate = useCallback((clip: Clip, actualStartTime: number) => {
		const drift = actualStartTime - clip.start;
		if (Math.abs(drift) < 0.1) return;
		setClips((prev) => prev.map(c => ({
			...c,
			start: Number((c.start + drift).toFixed(2)),
			end: Number((c.end + drift).toFixed(2))
		})));
		toast.success(`Sincronia global ajustada em ${drift.toFixed(1)}s!`);
	}, []);

	// 5. EFEITOS AUTOMÁTICOS
	useEffect(() => {
		if (isMock) return;
		const unrefined = clips.filter((c) => !refinedTranscripts[c.id]);
		if (unrefined.length > 0 && !isRefining) {
			const nextClip = unrefined[0];
			const timer = setTimeout(() => handleRefineCaptions(nextClip), 1000);
			return () => clearTimeout(timer);
		}
	}, [clips, refinedTranscripts, isRefining, handleRefineCaptions, isMock]);

	useEffect(() => {
		if (videoFile) {
			const url = URL.createObjectURL(videoFile);
			setVideoUrl(url);
			return () => URL.revokeObjectURL(url);
		}
	}, [videoFile]);

	const handleDiscardTranscript = useCallback(() => {
		setEditableTranscript(transcript || "");
		setIsEditingTranscript(false);
	}, [transcript]);

	const handleSaveTranscript = useCallback(() => {
		setIsEditingTranscript(false);
		toast.success("Transcrição atualizada!");
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
							? initialWords.filter(w => w.start >= activeClip.start - 2 && w.end <= activeClip.end + 2) 
							: transcript)
					}
					onClose={() => setActiveClip(null)}
					onCalibrate={handleGlobalCalibrate}
				/>
			)}
			
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							placeholder="Pesquisar clips..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => setSortBy((s) => (s === "score" ? "start" : "score"))}
					>
						<SlidersHorizontal className="w-4 h-4" />
					</Button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{filtered.map((clip) => (
						<ClipCard
							key={clip.id}
							clip={clip}
							isSelected={selectedClips.includes(clip.id)}
							isResolving={isResolving === clip.id}
							videoUrl={videoUrl}
							onToggle={(id) => setSelectedClips(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
							onRemove={(id) => setClips(prev => prev.filter(x => x.id !== id))}
							onExpand={setActiveClip}
							onExport={handleExportClip}
							onEditInTimeline={handleEditInTimeline}
							onOpenCaptionGenerator={() => {}}
							onPreview={setActiveClip}
							onNudgeStart={(c, d) => setClips(prev => prev.map(x => x.id === c.id ? { ...x, start: Math.max(0, x.start + d) } : x))}
							onNudgeEnd={(c, d) => setClips(prev => prev.map(x => x.id === c.id ? { ...x, end: x.end + d } : x))}
							isRefining={isRefining === clip.id}
							hasRefinedTranscript={!!refinedTranscripts[clip.id]}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

import { nanoid } from "nanoid";
