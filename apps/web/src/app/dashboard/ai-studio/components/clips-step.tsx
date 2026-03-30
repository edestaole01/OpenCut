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
import { transcriptionService } from "@/services/transcription/service";
import {
	isDemoTranscript,
	isAudioCueOnlyTranscript,
	isMissingSpecificTranscript,
	sanitizeCaptionText,
	extractClipTranscript,
	getClipTranscriptSegments,
	wrapCaptionText,
} from "../utils/transcript-utils";
import type { TranscriptionResult } from "@/types/transcription";

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

interface Clip {
	id: string;
	title: string;
	start: number;
	end: number;
	score: number;
	tag: string;
	caption: string;
}

interface ClipsStepProps {
	clips: Clip[];
	videoFile: File | null;
	videoUrl?: string;
	transcript?: string;
	transcriptSource?: string;
	isMock?: boolean;
	onBack: () => void;
	onPublish: () => void;
	onRequestVideoReupload?: (clip: Clip) => void;
}

const ALL_TAGS = ["Todos", "Gancho", "Tutorial", "Story", "Dica", "CTA"];
const CAPTION_PREFILL_STORAGE_KEY = "opencut:captions-prefill";

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
}: {
	videoFile: File;
	clip: Clip;
}): Promise<TranscriptionResult | null> {
	try {
		const clipDuration = Math.max(0.6, clip.end - clip.start);
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
							trimStart: clip.start,
							trimEnd: clip.start + clipDuration,
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
		try {
			return await transcriptionService.transcribe({
				audioData: audioBlob,
				samples: samples,
				useRemote: true,
				sampleRate,
			});
		} catch (remoteErr) {
			console.warn(
				"Remote per-clip transcription failed, forcing local:",
				remoteErr,
			);
			try {
				return await transcriptionService.transcribe({
					audioData: samples,
					useRemote: false,
					sampleRate,
				});
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
	isMock = false,
	onBack,
	onPublish,
	onRequestVideoReupload,
}: ClipsStepProps) {
	const router = useRouter();
	const setActiveAssetsTab = useAssetsPanelStore((state) => state.setActiveTab);

	const [clips, setClips] = useState(initialClips);
	const [selectedClips, setSelectedClips] = useState<string[]>(
		initialClips.map((c) => c.id),
	);
	const [showTranscript, setShowTranscript] = useState(false);
	const [activeClip, setActiveClip] = useState<Clip | null>(null);
	const [exportClip, setExportClip] = useState<Clip | null>(null);
	const [exportVideoFile, setExportVideoFile] = useState<File | null>(
		videoFile,
	);
	const [videoUrl, setVideoUrl] = useState<string | null>(
		initialVideoUrl ?? null,
	);
	const [isResolving, setIsResolving] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [activeTag, setActiveTag] = useState("Todos");
	const [sortBy, setSortBy] = useState<"score" | "start">("score");
	const [editableTranscript, setEditableTranscript] = useState(
		isAudioCueOnlyTranscript(transcript || "") ? "" : transcript || "",
	);
	const [isEditingTranscript, setIsEditingTranscript] = useState(false);

	const userProvidedTranscript = useMemo(() => {
		const current = (editableTranscript || "").trim();
		if (!current) return false;
		return current !== (transcript || "").trim();
	}, [editableTranscript, transcript]);

	const transcriptIsDemo = useMemo(() => {
		const sourceIsMock = transcriptSource === "mock" || isMock;
		const textLooksDemo = isDemoTranscript(editableTranscript || "");
		const textLooksAudioCueOnly = isAudioCueOnlyTranscript(
			editableTranscript || "",
		);
		return (
			(sourceIsMock || textLooksDemo || textLooksAudioCueOnly) &&
			!userProvidedTranscript
		);
	}, [transcriptSource, isMock, editableTranscript, userProvidedTranscript]);

	useEffect(() => {
		if (isAudioCueOnlyTranscript(transcript || "")) {
			setEditableTranscript("");
			return;
		}
		setEditableTranscript(transcript || "");
	}, [transcript]);

	useEffect(() => {
		if (!videoFile) {
			setVideoUrl(initialVideoUrl ?? null);
			return;
		}
		const url = URL.createObjectURL(videoFile);
		setVideoUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [videoFile, initialVideoUrl]);

	const filtered = useMemo(() => {
		let list = [...clips];
		if (search.trim()) {
			const q = search.toLowerCase();
			list = list.filter(
				(c) =>
					c.title.toLowerCase().includes(q) ||
					c.caption.toLowerCase().includes(q) ||
					c.tag.toLowerCase().includes(q),
			);
		}
		if (activeTag !== "Todos") list = list.filter((c) => c.tag === activeTag);
		if (sortBy === "score") list.sort((a, b) => b.score - a.score);
		else list.sort((a, b) => a.start - b.start);
		return list;
	}, [clips, search, activeTag, sortBy]);

	const toggleClip = useCallback((id: string) => {
		setSelectedClips((prev) =>
			prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
		);
	}, []);

	const removeClip = useCallback((id: string) => {
		setClips((prev) => prev.filter((c) => c.id !== id));
		setSelectedClips((prev) => prev.filter((c) => c !== id));
	}, []);

	const resolveSourceVideoFile = useCallback(async (): Promise<File | null> => {
		// Se a URL é do servidor (histórico), busca dela primeiro para garantir o arquivo correto.
		// Não usa videoFile como atalho pois pode ser de um upload diferente na mesma sessão.
		if (videoUrl && !videoUrl.startsWith("blob:")) {
			try {
				// Tenta a URL de streaming dedicada (suporta Range requests)
				const apiUrl = `/api/ai-studio/file?path=${encodeURIComponent(videoUrl)}`;
				const response = await fetch(apiUrl);
				if (response.ok) {
					const blob = await response.blob();
					const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
					return new File([blob], decodeURIComponent(rawName), {
						type: blob.type || "video/mp4",
					});
				}
			} catch (error) {
				console.warn("Could not resolve video file from API route:", error);
			}
			// Fallback: tenta URL direta (funciona em produção via CDN)
			try {
				const response = await fetch(videoUrl);
				if (response.ok) {
					const blob = await response.blob();
					const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
					return new File([blob], decodeURIComponent(rawName), {
						type: blob.type || "video/mp4",
					});
				}
			} catch {
				// Ignora — cai no videoFile abaixo
			}
		}

		// Blob URL da sessão atual
		if (videoUrl?.startsWith("blob:")) {
			try {
				const check = await fetch(videoUrl, { method: "HEAD" }).catch(() => null);
				if (check?.ok) {
					const response = await fetch(videoUrl);
					if (response.ok) {
						const blob = await response.blob();
						const rawName = videoUrl.split("?")[0]?.split("/").pop() || "video.mp4";
						return new File([blob], decodeURIComponent(rawName), {
							type: blob.type || "video/mp4",
						});
					}
				}
			} catch (error) {
				console.warn("Could not resolve blob URL:", error);
			}
		}

		// Último recurso: arquivo em memória da sessão atual
		if (videoFile) return videoFile;

		return null;
	}, [videoFile, videoUrl]);

	const handleExportClip = useCallback(
		async (clip: Clip) => {
			setIsResolving(clip.id);
			const sourceVideoFile = await resolveSourceVideoFile();
			setIsResolving(null);
			if (!sourceVideoFile) {
				if (onRequestVideoReupload) {
					onRequestVideoReupload(clip);
					toast.info("Por favor, reconecte o vídeo original para exportar.");
				} else {
					toast.error(
						"Vídeo original não disponível. Tente reenviar o arquivo.",
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
			if (transcriptSeed && !isDemoTranscript(transcriptSeed)) {
				const extracted = extractClipTranscript(
					transcriptSeed,
					clip.start,
					clip.end,
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

	const handleEditInTimeline = useCallback(
		async (clip: Clip) => {
			setIsResolving(clip.id);
			const sourceVideoFile = await resolveSourceVideoFile();
			if (!sourceVideoFile) {
				setIsResolving(null);
				if (onRequestVideoReupload) {
					onRequestVideoReupload(clip);
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

				const perClipResult = await transcribeClipAudio({
					videoFile: sourceVideoFile,
					clip,
				});

				const projectId = await editor.project.createNewProject({
					name: `Clip: ${clip.title}`,
					settings: { canvasSize: { width: 1080, height: 1920 } },
				});

				const [processedAsset] = await processMediaAssets({
					files: [sourceVideoFile],
				});
				if (!processedAsset)
					throw new Error(
						"Falha ao processar o arquivo de vídeo para timeline",
					);

				const assetId = await editor.media.addMediaAsset({
					projectId,
					asset: processedAsset,
				});

				const clipDuration = clip.end - clip.start;
				editor.timeline.insertElement({
					placement: { mode: "auto", trackType: "video" },
					element: {
						type: "video",
						mediaId: assetId,
						name: clip.title,
						startTime: 0,
						trimStart: clip.start,
						trimEnd: clip.end,
						duration: clipDuration,
						transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
						opacity: 1,
					} as unknown as Parameters<
						typeof editor.timeline.insertElement
					>[0]["element"],
				});

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
								const startTime = chunkWords[0].start;
								const duration = Math.max(
									0.6,
									chunkWords[chunkWords.length - 1].end - startTime,
								);
								clipTranscriptSegments.push({ startTime, duration, content });
							}
						} else {
							clipTranscriptSegments.push({
								startTime: segment.start,
								duration: Math.max(0.8, segment.end - segment.start),
								content: wrapCaptionText(segment.text, 18),
							});
						}
					}
				} else {
					const cleanedGlobal = (transcript || "").trim();
					if (cleanedGlobal && !isDemoTranscript(cleanedGlobal)) {
						const relevantSegments = getClipTranscriptSegments(
							cleanedGlobal,
							clip.start,
							clip.end,
						);
						clipTranscriptSegments = relevantSegments.map((s) => ({
							startTime: Math.max(0, s.start - clip.start),
							duration: Math.max(
								0.8,
								Math.min(clip.end, s.end) - Math.max(clip.start, s.start),
							),
							content: wrapCaptionText(s.text, 18),
						}));
						finalTranscriptText = relevantSegments.map((s) => s.text).join(" ");
					}
				}

				if (clipTranscriptSegments.length > 0 || finalTranscriptText) {
					const masterTrackId = editor.timeline.addTrack({ type: "text" });
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId: masterTrackId },
						element: {
							type: "text",
							name: "Transcricao AI",
							content:
								finalTranscriptText ||
								clip.caption ||
								"Sem transcrição disponível",
							startTime: 0,
							duration: clipDuration,
							hidden: true,
						} as unknown as Parameters<
							typeof editor.timeline.insertElement
						>[0]["element"],
					});

					const captionsTrackId = editor.timeline.addTrack({ type: "text" });
					clipTranscriptSegments.forEach((segment, index) => {
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId: captionsTrackId },
							element: {
								type: "text",
								name: `Caption ${index + 1}`,
								content: segment.content.toUpperCase(),
								startTime: segment.startTime,
								duration: segment.duration,
								fontSize: 4.5,
								fontFamily: "Inter",
								color: "#ffffff",
								textAlign: "center",
								fontWeight: "900",
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
							} as unknown as Parameters<
								typeof editor.timeline.insertElement
							>[0]["element"],
						});
					});
				}

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
		],
	);

	const handleDiscardTranscript = useCallback(() => {
		setEditableTranscript(transcript || "");
		setIsEditingTranscript(false);
	}, [transcript]);

	const handleSaveTranscript = useCallback(() => {
		setIsEditingTranscript(false);
		toast.success("Transcrição atualizada localmente!");
	}, []);

	return (
		<div className="space-y-5">
			{activeClip && videoUrl && (
				<VideoModal
					clip={activeClip}
					videoUrl={videoUrl}
					transcript={transcript}
					onClose={() => setActiveClip(null)}
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
							Reconecte seu vídeo para editar
						</p>
						<p className="text-muted-foreground text-xs">
							Não encontramos uma cópia local do vídeo. Selecione o arquivo
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
					Esta análise está em modo demonstração. O texto mostrado não é a
					transcrição real do vídeo.
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
						{sortBy === "score" ? "↓ Maior score" : "↓ Cronológico"}
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
							key={clip.id}
							clip={clip}
							isSelected={selectedClips.includes(clip.id)}
							isResolving={isResolving === clip.id}
							videoUrl={videoUrl}
							onToggle={toggleClip}
							onRemove={removeClip}
							onExpand={setActiveClip}
							onExport={handleExportClip}
							onEditInTimeline={handleEditInTimeline}
							onOpenCaptionGenerator={handleOpenCaptionGenerator}
						/>
					))}
				</div>
			)}
		</div>
	);
}
