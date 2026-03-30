import { Button } from "@/components/ui/button";
import { FontPicker } from "@/components/ui/font-picker";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useState, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import {
	TRANSCRIPTION_LANGUAGES,
	DEFAULT_WORDS_PER_CAPTION,
} from "@/constants/transcription-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { FONT_SIZE_SCALE_REFERENCE } from "@/constants/text-constants";
import type {
	CaptionChunk,
	TranscriptionLanguage,
	TranscriptionProgress,
} from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Search,
	Play,
	Edit3,
	Trash2,
	Languages,
	Sparkles,
	Download,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";

import { CAPTION_PRESETS } from "@/constants/caption-presets";
import { cn } from "@/utils/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function buildEvenlySpacedChunks({
	transcript,
	totalDuration,
	wordsPerChunk,
	minDuration,
}: {
	transcript: string;
	totalDuration: number;
	wordsPerChunk: number;
	minDuration: number;
}): CaptionChunk[] {
	const words = transcript
		.split(/\s+/)
		.map((w) => w.trim())
		.filter(Boolean);
	if (words.length === 0 || totalDuration <= 0) return [];
	const chunks: CaptionChunk[] = [];
	const chunkCount = Math.ceil(words.length / wordsPerChunk);
	const durationPerChunk = Math.max(minDuration, totalDuration / chunkCount);

	for (let i = 0; i < words.length; i += wordsPerChunk) {
		const chunkWords = words.slice(i, i + wordsPerChunk);
		const idx = chunks.length;
		chunks.push({
			text: chunkWords.join(" "),
			startTime: idx * durationPerChunk,
			duration:
				idx === chunkCount - 1
					? Math.max(minDuration, totalDuration - idx * durationPerChunk)
					: durationPerChunk,
		});
	}

	return chunks;
}

function cleanCaptionText(text: string): string {
	return text
		.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

const AUTO_CAPTION_NAME_PREFIX = "Caption ";
const ITEMS_PER_PAGE = 12;

function normalizeText(value: string | undefined): string {
	return (value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function isPlaceholderTextElement(content: string | undefined): boolean {
	const normalized = normalizeText(content);
	return (
		normalized === "default text" ||
		normalized === "cole ou edite a transcricao aqui." ||
		normalized === "cole ou edite a transcricao aqui"
	);
}

/**
 * Quebra o texto em linhas usando medição real de canvas para não ultrapassar maxWidthPx.
 */
function wrapTextToFit(text: string, fontString: string, maxWidthPx: number): string {
	if (typeof document === "undefined") return text;
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return text;
	ctx.font = fontString;

	const words = text.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const test = current ? `${current} ${word}` : word;
		if (ctx.measureText(test).width > maxWidthPx && current) {
			lines.push(current);
			current = word;
		} else {
			current = test;
		}
	}
	if (current) lines.push(current);
	return lines.join("\n");
}

function isAutoCaptionElement({ name }: { name: string }) {
	const normalized = normalizeText(name);
	return (
		normalized.startsWith(normalizeText(AUTO_CAPTION_NAME_PREFIX)) ||
		normalized === "legenda ai" ||
		normalized.startsWith("legenda ai ")
	);
}

function isCaptionElementForPanel({
	name,
	content,
}: {
	name?: string;
	content?: string;
}): boolean {
	if (isPlaceholderTextElement(content)) return false;
	const normalizedName = normalizeText(name);
	if (isAutoCaptionElement({ name: normalizedName })) return true;
	return (
		normalizedName.includes("caption") ||
		normalizedName.includes("legenda") ||
		normalizedName.includes("transcricao") ||
		normalizedName.includes("subtitle")
	);
}

function formatTime(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatSRTTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	const ms = Math.round((seconds % 1) * 1000);
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

function generateSRT(
	captions: { content: string; startTime: number; duration: number }[],
): string {
	return captions
		.map((cap, i) => {
			const start = formatSRTTime(cap.startTime);
			const end = formatSRTTime(cap.startTime + cap.duration);
			return `${i + 1}\n${start} --> ${end}\n${cap.content}`;
		})
		.join("\n\n");
}

function downloadSRT(content: string, filename = "legendas.srt") {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function formatVTTTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	const ms = Math.round((seconds % 1) * 1000);
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function generateVTT(
	captions: { content: string; startTime: number; duration: number }[],
): string {
	const body = captions
		.map((cap) => {
			const start = formatVTTTime(cap.startTime);
			const end = formatVTTTime(cap.startTime + cap.duration);
			return `${start} --> ${end}\n${cap.content}`;
		})
		.join("\n\n");
	return `WEBVTT\n\n${body}`;
}

function downloadVTT(content: string, filename = "legendas.vtt") {
	const blob = new Blob([content], { type: "text/vtt;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [selectedPresetId, setSelectedPresetId] = useState<string>(
		CAPTION_PRESETS[0].id,
	);
	const [wordsPerChunk, setWordsPerChunk] = useState(DEFAULT_WORDS_PER_CAPTION);
	// Unidade relativa do renderer: pixel_real = fontSizeRelative × (canvasHeight / FONT_SIZE_SCALE_REFERENCE)
	// Valor 4.0 → ~85px em canvas 1920px, ~48px em canvas 1080px
	const [fontSizeRelative, setFontSizeRelative] = useState(4.0);
	const [captionColor, setCaptionColor] = useState("#ffffff");
	const [captionFontFamily, setCaptionFontFamily] = useState("Inter");
	const [captionTextCase, setCaptionTextCase] = useState<"none" | "uppercase" | "lowercase" | "capitalize" | "sentence">("none");
	const [isProcessing, setIsProcessing] = useState(false);
	const [isInsertingCaptions, setIsInsertingCaptions] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [processingProgress, setProcessingProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebounce(searchQuery);
	const [generatedTranscriptText, setGeneratedTranscriptText] = useState("");
	const [generatedCaptionChunks, setGeneratedCaptionChunks] = useState<
		CaptionChunk[]
	>([]);
	const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
	const [_confirmRegenOpen, _setConfirmRegenOpen] = useState(false);
	const [editPage, setEditPage] = useState(1);
	const [captionY, setCaptionY] = useState(520);
	const containerRef = useRef<HTMLDivElement>(null);
	const editor = useEditor();

	const activeProject = editor.project.getActive();
	const canvasHeight = activeProject?.settings.canvasSize.height ?? 1920;
	const canvasWidth = activeProject?.settings.canvasSize.width ?? 1080;

	const selectedPreset =
		CAPTION_PRESETS.find((p) => p.id === selectedPresetId) ??
		CAPTION_PRESETS[0];
	const isHormozi = selectedPresetId === "hormozi";
	const effectiveWordsPerChunk = isHormozi ? 1 : wordsPerChunk;

	// px visível no canvas = fontSizeRelative × (canvasHeight / FONT_SIZE_SCALE_REFERENCE)
	const fontSizePx = Math.round(fontSizeRelative * (canvasHeight / FONT_SIZE_SCALE_REFERENCE));

	const reapplyToExistingCaptions = (overrides: {
		overrideFontSize?: number;
		overrideColor?: string;
		overrideFontFamily?: string;
	} = {}) => {
		const autoCaptions = captionElements.filter((e) =>
			isAutoCaptionElement({ name: e.name }),
		);
		if (autoCaptions.length === 0) return;
		const chunks: CaptionChunk[] = autoCaptions.map((e) => ({
			text: e.content,
			startTime: e.startTime,
			duration: e.duration,
		}));
		insertCaptionsToTimeline({ captionChunks: chunks, ...overrides });
	};

	const handleSelectPreset = (presetId: string) => {
		setSelectedPresetId(presetId);
		// Converte o fontSize do preset (pixels) para a unidade relativa do renderer
		const preset = CAPTION_PRESETS.find((p) => p.id === presetId);
		if (!preset) return;

		const defaultRelative = (preset.styles.fontSize ?? 48) * FONT_SIZE_SCALE_REFERENCE / canvasHeight;
		const newFontSizeRelative = Math.round(defaultRelative * 10) / 10;
		setFontSizeRelative(newFontSizeRelative);
		const newColor = preset.styles.color ?? captionColor;
		const newFontFamily = preset.styles.fontFamily ?? captionFontFamily;
		setCaptionColor(newColor);
		setCaptionFontFamily(newFontFamily);

		// Auto-aplica nas legendas existentes passando os valores novos diretamente
		reapplyToExistingCaptions({
			overrideFontSize: newFontSizeRelative,
			overrideColor: newColor,
			overrideFontFamily: newFontFamily,
		});
	};

	const hasGeneratedTranscript =
		generatedCaptionChunks.length > 0 ||
		generatedTranscriptText.trim().length > 0;

	const tracks = editor.timeline.getTracks();
	const captionElements = tracks
		.filter((track) => track.type === "text")
		.flatMap((track) =>
			track.elements
				.filter((element) =>
					isCaptionElementForPanel({
						name: element.name,
						content: element.content,
					}),
				)
				.map((element) => ({ ...element, trackId: track.id })),
		)
		.sort((a, b) => a.startTime - b.startTime);

	const filteredCaptions = useMemo(() => {
		if (!debouncedSearchQuery.trim()) return captionElements;
		return captionElements.filter((c) =>
			c.content.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
		);
	}, [captionElements, debouncedSearchQuery]);

	const totalPages = Math.max(
		1,
		Math.ceil(filteredCaptions.length / ITEMS_PER_PAGE),
	);
	const paginatedCaptions = filteredCaptions.slice(
		(editPage - 1) * ITEMS_PER_PAGE,
		editPage * ITEMS_PER_PAGE,
	);

	const handleProgress = (progress: TranscriptionProgress) => {
		const statusMap: Record<string, string> = {
			"loading-model": "Carregando IA...",
			transcribing: "Transcrevendo áudio...",
		};
		setProcessingStep(statusMap[progress.status] || progress.status);
		setProcessingProgress(progress.progress);
	};

	const handleUpdateCaption = (
		id: string,
		trackId: string,
		content: string,
	) => {
		editor.timeline.updateElement({
			trackId,
			elementId: id,
			patch: { content },
		});
	};

	const handleDeleteCaption = (id: string, trackId: string) => {
		editor.timeline.deleteElements({ elements: [{ trackId, elementId: id }] });
	};

	const handleSeek = (time: number) => {
		editor.playback.seek({ time });
	};

	const handleJumpToCurrent = () => {
		const now = editor.playback.getCurrentTime();
		if (filteredCaptions.length === 0) return;

		let targetIndex = filteredCaptions.findIndex(
			(c) => now >= c.startTime && now <= c.startTime + c.duration,
		);

		if (targetIndex === -1) {
			targetIndex =
				filteredCaptions.findIndex((c) => c.startTime > now) ??
				filteredCaptions.length - 1;
			if (targetIndex === -1) targetIndex = filteredCaptions.length - 1;
		}

		const targetPage = Math.floor(targetIndex / ITEMS_PER_PAGE) + 1;
		setEditPage(targetPage);

		requestAnimationFrame(() => {
			const el = document.getElementById(
				`caption-${filteredCaptions[targetIndex]?.id}`,
			);
			el?.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	};

	const handleExportSubtitles = (format: "srt" | "vtt") => {
		if (captionElements.length === 0) {
			toast.error("Nenhuma legenda para exportar.");
			return;
		}

		if (format === "srt") {
			const srt = generateSRT(captionElements);
			downloadSRT(srt);
			toast.success("Arquivo .srt baixado!");
			return;
		}

		const vtt = generateVTT(captionElements);
		downloadVTT(vtt);
		toast.success("Arquivo .vtt baixado!");
	};

	const handleDeleteAutoCaptions = () => {
		const textTracks = editor.timeline
			.getTracks()
			.filter((track) => track.type === "text");
		const autoTracks = textTracks.filter(
			(track) =>
				track.elements.length > 0 &&
				track.elements.every((element) =>
					isAutoCaptionElement({ name: element.name }),
				),
		);
		const autoElements = textTracks.flatMap((track) =>
			track.elements
				.filter((element) => isAutoCaptionElement({ name: element.name }))
				.map((element) => ({ trackId: track.id, elementId: element.id })),
		);

		if (autoElements.length === 0) {
			toast.message("Nenhuma legenda automática para remover.");
			return;
		}

		editor.timeline.deleteElements({ elements: autoElements });
		autoTracks.forEach((track) => editor.timeline.removeTrack({ trackId: track.id }));
		toast.success("Faixas de legendas automáticas removidas.");
	};

	const insertCaptionsToTimeline = ({
		captionChunks,
		overrideFontSize,
		overrideColor,
		overrideFontFamily,
	}: {
		captionChunks: CaptionChunk[];
		overrideFontSize?: number;
		overrideColor?: string;
		overrideFontFamily?: string;
	}) => {
		if (captionChunks.length === 0) return;

		const textTracks = editor.timeline
			.getTracks()
			.filter((track) => track.type === "text");

		const tracksOnlyAuto = textTracks.filter(
			(track) =>
				track.elements.length > 0 &&
				track.elements.every((element) =>
					isAutoCaptionElement({ name: element.name }),
				),
		);

		const autoElements = textTracks.flatMap((track) =>
			track.elements
				.filter((element) => isAutoCaptionElement({ name: element.name }))
				.map((element) => ({ trackId: track.id, elementId: element.id })),
		);
		if (autoElements.length > 0) {
			editor.timeline.deleteElements({ elements: autoElements });
		}

		tracksOnlyAuto.forEach((track) => {
			editor.timeline.removeTrack({ trackId: track.id });
		});

		const tracksAfterCleanup = editor.timeline
			.getTracks()
			.filter((track) => track.type === "text");

		const emptyTextTrack = tracksAfterCleanup.find(
			(track) => track.elements.length === 0,
		);

		// Sempre cria/repõe uma faixa dedicada para as legendas
		let captionTrackId: string | null =
			emptyTextTrack?.id ?? editor.timeline.addTrack({ type: "text", index: 0 });

		if (!captionTrackId) throw new Error("Falha ao criar track de legendas");

		const yPos = captionY;
		// fontSize usa a unidade relativa do renderer.
		// O controle fontSizeRelative já está nessa unidade — sem conversão necessária.
		const fontSize = overrideFontSize ?? fontSizeRelative;
		const fontWeight =
			selectedPreset.styles.fontWeight === "bold" ||
			selectedPreset.styles.fontWeight === "900" ||
			selectedPreset.styles.fontWeight === "black"
				? "900"
				: "normal";

		// Máximo 85% da largura do canvas para deixar margens
		const resolvedColor = overrideColor ?? captionColor;
		const resolvedFontFamily = overrideFontFamily ?? captionFontFamily;
		const scaledFontSizePx = fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
		const fontString = `${fontWeight === "900" ? "bold" : "normal"} ${scaledFontSizePx}px ${resolvedFontFamily}, sans-serif`;
		const maxLineWidthPx = canvasWidth * 0.85;

		const applyCase = (text: string): string => {
			switch (captionTextCase) {
				case "uppercase": return text.toUpperCase();
				case "lowercase": return text.toLowerCase();
				case "capitalize": return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
				case "sentence": return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
				default:
					// Fallback ao preset (para manter compatibilidade)
					if (selectedPreset.styles.textCase === "uppercase") return text.toUpperCase();
					return text;
			}
		};

		const elementsToInsert = captionChunks.map((caption, i) => {
			let content = cleanCaptionText(caption.text);
			content = applyCase(content);
			// Quebra linhas longas para não ultrapassar a largura do canvas
			content = wrapTextToFit(content, fontString, maxLineWidthPx);

			const captionElement = buildTextElement({
				raw: {
					name: `${AUTO_CAPTION_NAME_PREFIX}${i + 1}`,
					content,
					duration: caption.duration,
					fontSize,
					fontWeight,
					color: resolvedColor,
					textAlign: "center",
					fontFamily: resolvedFontFamily,
					transform: { position: { x: 0, y: yPos }, scale: 1, rotate: 0 },
					shadow: {
						enabled: true,
						color: "rgba(0,0,0,0.8)",
						blur: 4,
						offsetX: 2,
						offsetY: 2,
					},
					background: {
						enabled: true,
						color: "rgba(0,0,0,0.8)",
						cornerRadius: 8,
						paddingX: 30,
						paddingY: 15,
					},
				} as unknown as Parameters<typeof buildTextElement>[0]["raw"],
				startTime: caption.startTime,
			});

			return {
				element: captionElement,
				placement: { mode: "explicit" as const, trackId: captionTrackId },
			};
		});

		editor.timeline.insertElements({ elements: elementsToInsert });
	};

	const runGenerate = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setGeneratedTranscriptText("");
			setGeneratedCaptionChunks([]);
			setDetectedLanguage(null);

			const totalDuration = editor.timeline.getTotalDuration();
			if (totalDuration <= 0) {
				throw new Error("Adicione um vídeo ou áudio à linha do tempo primeiro.");
			}

			setProcessingStep("Extraindo áudio...");
			setProcessingProgress(10);

			const audioBlob = await extractTimelineAudio({
				tracks: editor.timeline.getTracks(),
				mediaAssets: editor.media.getAssets(),
				totalDuration,
				onProgress: (p) => setProcessingProgress(10 + p * 0.2),
			});

			setProcessingStep("Preparando áudio...");
			setProcessingProgress(35);
			const { samples, sampleRate } = await decodeAudioToFloat32({ audioBlob });

			const result = await transcriptionService.transcribe({
				audioData: audioBlob,
				samples,
				sampleRate,
				language: selectedLanguage === "auto" ? undefined : selectedLanguage,
				onProgress: (p) => {
					setProcessingProgress(40 + p.progress * 0.55);
					handleProgress(p);
				},
			});

			setProcessingStep("Finalizando legendas...");
			setProcessingProgress(98);

			if (result.language) {
				const langName =
					TRANSCRIPTION_LANGUAGES.find((l) => l.code === result.language)
						?.name ?? result.language;
				setDetectedLanguage(langName);
			}

			const captionChunks = buildCaptionChunks({
				segments: result.segments,
				wordsPerChunk: effectiveWordsPerChunk,
			});

			// Se a transcrição falhou em retornar chunks com timestamps, mas temos texto,
			// usamos a distribuição uniforme como fallback.
			const safeCaptionChunks =
				captionChunks.length > 0
					? captionChunks
					: buildEvenlySpacedChunks({
							transcript: result.text || "",
							totalDuration: totalDuration,
							wordsPerChunk: effectiveWordsPerChunk,
							minDuration: MIN_CAPTION_DURATION_SECONDS,
						});

			setGeneratedTranscriptText(result.text ?? "");
			setGeneratedCaptionChunks(safeCaptionChunks);
			insertCaptionsToTimeline({ captionChunks: safeCaptionChunks });
			toast.success(`Legendas inseridas! (${safeCaptionChunks.length} blocos)`);
		} catch (err) {
			console.error("Transcription failed:", err);
			const message =
				err instanceof Error
					? err.message
					: "Erro inesperado ao gerar legendas";
			setError(message);
			if (message === "Transcription cancelled") {
				toast.message("Transcrição cancelada");
			} else {
				toast.error("Falha ao gerar legendas");
			}
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
			setProcessingProgress(0);
		}
	};

	const handleGenerateTranscript = () => {
		runGenerate();
	};

	const handleInsertTranscriptIntoVideo = async () => {
		if (generatedCaptionChunks.length === 0) {
			toast.error("Gere a transcrição primeiro.");
			return;
		}
		try {
			setIsInsertingCaptions(true);
			insertCaptionsToTimeline({ captionChunks: generatedCaptionChunks });
			toast.success("Legendas reinseridas no vídeo.");
		} catch (err) {
			console.error("Failed to insert captions:", err);
			toast.error("Não foi possível inserir as legendas.");
		} finally {
			setIsInsertingCaptions(false);
		}
	};

	return (
		<PanelView title="Captions & Subtitles" ref={containerRef}>
			<Tabs defaultValue="generate" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-4">
					<TabsTrigger value="generate" className="gap-1.5">
						<Sparkles className="w-3.5 h-3.5" /> Gerar
					</TabsTrigger>
					<TabsTrigger value="edit" className="gap-1.5">
						<Edit3 className="w-3.5 h-3.5" /> Editar
					</TabsTrigger>
				</TabsList>

				{/* ── GERAR ── */}
				<TabsContent value="generate" className="space-y-5 mt-0">
					{/* Passo 1: Estilo */}
					<div className="flex items-center gap-2">
						<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">1</span>
						<span className="text-xs font-semibold uppercase tracking-wider text-foreground">Escolha o Estilo</span>
					</div>
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-3 gap-1.5">
							{CAPTION_PRESETS.map((preset) => {
								const bg = preset.styles.background?.enabled
									? preset.styles.background.color
									: "transparent";
								const stroke = preset.styles.strokeColor;
								const textShadow = stroke
									? `0 0 3px ${stroke}, 0 0 3px ${stroke}`
									: undefined;
								return (
									<button
										key={preset.id}
										type="button"
										className={cn(
											"flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all hover:bg-accent group",
											selectedPresetId === preset.id
												? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
												: "border-border",
										)}
										onClick={() => handleSelectPreset(preset.id)}
									>
										<div
											className="flex h-10 w-full items-center justify-center rounded-md overflow-hidden"
											style={{ background: "hsl(var(--muted))" }}
										>
											<span
												style={{
													color: preset.styles.color ?? "#fff",
													fontSize: "11px",
													fontWeight:
														preset.styles.fontWeight === "black" ||
														preset.styles.fontWeight === "900" ||
														preset.styles.fontWeight === "bold"
															? "900"
															: "500",
													textTransform:
														preset.styles.textCase === "uppercase"
															? "uppercase"
															: "none",
													backgroundColor: bg,
													padding: preset.styles.background?.enabled
														? "2px 8px"
														: undefined,
													borderRadius: preset.styles.background?.enabled
														? `${preset.styles.background.cornerRadius}px`
														: undefined,
													textShadow,
												}}
											>
												{preset.name.split(" ")[0]}
											</span>
										</div>
										<span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors leading-none">
											{preset.name}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Passo 2: Configuração */}
					<div className="flex items-center gap-2 pt-1">
						<span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">2</span>
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configure a Geração</span>
					</div>

					{/* Idioma */}
					<div className="flex flex-col gap-2">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Idioma do Áudio
						</Label>
						<Select
							value={selectedLanguage}
							onValueChange={(v) =>
								setSelectedLanguage(v as TranscriptionLanguage)
							}
						>
							<SelectTrigger className="bg-muted/30 border-muted-foreground/20">
								<Languages className="w-4 h-4 mr-2 text-muted-foreground" />
								<SelectValue placeholder="Auto detectar" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="auto">
									Auto detectar (Recomendado)
								</SelectItem>
								{TRANSCRIPTION_LANGUAGES.map((language) => (
									<SelectItem key={language.code} value={language.code}>
										{language.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{detectedLanguage && (
							<p className="text-[11px] text-muted-foreground">
								Idioma detectado:{" "}
								<span className="font-semibold text-primary">
									{detectedLanguage}
								</span>
							</p>
						)}
					</div>

					{/* Palavras por legenda */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Palavras por legenda
							</Label>
							<span className="text-xs font-bold text-primary">
								{isHormozi ? "1 (fixo)" : effectiveWordsPerChunk}
							</span>
						</div>
						<Slider
							min={1}
							max={6}
							step={1}
							value={[isHormozi ? 1 : wordsPerChunk]}
							onValueChange={([v]) => setWordsPerChunk(v)}
							disabled={isHormozi}
							className={cn(isHormozi && "opacity-40")}
						/>
						{isHormozi && (
							<p className="text-[10px] text-muted-foreground">
								O estilo Alex Hormozi usa sempre 1 palavra por legenda.
							</p>
						)}
					</div>

					{/* Tamanho da fonte */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Tamanho da Fonte
							</Label>
							<span className="text-xs font-bold text-primary">~{fontSizePx}px</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 shrink-0"
								onClick={() => setFontSizeRelative((v) => Math.max(0.5, Math.round((v - 0.5) * 10) / 10))}
								disabled={fontSizeRelative <= 0.5}
							>
								−
							</Button>
							<Slider
								min={0.5}
								max={12}
								step={0.5}
								value={[fontSizeRelative]}
								onValueChange={([v]) => setFontSizeRelative(v)}
								className="flex-1"
							/>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 shrink-0"
								onClick={() => setFontSizeRelative((v) => Math.min(12, Math.round((v + 0.5) * 10) / 10))}
								disabled={fontSizeRelative >= 12}
							>
								+
							</Button>
						</div>
					</div>

					{/* Cor e Fonte */}
				<div className="flex gap-3">
					<div className="flex flex-col gap-2 flex-1">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Cor do Texto
						</Label>
						<div className="flex items-center gap-2">
							<div
								className="relative h-9 w-9 shrink-0 rounded-md border border-border overflow-hidden cursor-pointer"
								style={{ backgroundColor: captionColor }}
							>
								<input
									type="color"
									value={captionColor}
									onChange={(e) => {
										const newColor = e.target.value;
										setCaptionColor(newColor);
										reapplyToExistingCaptions({ overrideColor: newColor });
									}}
									className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
								/>
							</div>
							<span className="text-xs font-mono text-muted-foreground">{captionColor}</span>
						</div>
					</div>
					<div className="flex flex-col gap-2 flex-1 min-w-0">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Fonte
						</Label>
						<FontPicker
							defaultValue={captionFontFamily}
							onValueChange={(newFont) => {
								setCaptionFontFamily(newFont);
								reapplyToExistingCaptions({ overrideFontFamily: newFont });
							}}
						/>
					</div>
				</div>

				{/* Transformação de caixa */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Caixa do Texto
					</Label>
					<div className="flex gap-1">
						{([
							{ value: "none" as const, label: "Aa", title: "Original" },
							{ value: "uppercase" as const, label: "AA", title: "MAIÚSCULO" },
							{ value: "lowercase" as const, label: "aa", title: "minúsculo" },
							{ value: "capitalize" as const, label: "Ab", title: "Primeira Letra" },
							{ value: "sentence" as const, label: "A.", title: "Início de Frase" },
						]).map(({ value, label, title }) => (
							<Button
								key={value}
								variant={captionTextCase === value ? "default" : "outline"}
								size="sm"
								className="flex-1 h-8 px-0 text-xs font-mono"
								title={title}
								onClick={() => {
									setCaptionTextCase(value);
									reapplyToExistingCaptions();
								}}
							>
								{label}
							</Button>
						))}
					</div>
				</div>

				{/* Posição vertical */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Posição vertical das legendas
							</Label>
							<span className="text-xs font-bold text-primary">
								{captionY}px
							</span>
						</div>
						<Slider
							min={360}
							max={640}
							step={5}
							value={[captionY]}
							onValueChange={([v]) => setCaptionY(v)}
						/>
						<p className="text-[10px] text-muted-foreground">
							Ajuste para subir ou descer todas as legendas geradas/reinseridas.
						</p>
					</div>

					{/* Passo 3: Gerar */}
					<div className="flex items-center gap-2">
						<div className="h-px flex-1 bg-border" />
						<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Gerar Legendas</span>
						<div className="h-px flex-1 bg-border" />
					</div>

					{/* Erros e botão */}
					<div className="flex flex-col gap-3">
						{error && (
							<div className="bg-red-500/10 border-red-500/20 rounded-lg border p-3">
								<p className="text-red-500 text-xs font-medium">{error}</p>
							</div>
						)}

						{!isProcessing ? (
							<div className="flex gap-2">
								<Button
									className="flex-1 h-11 font-bold gap-2 shadow-lg shadow-primary/20"
									onClick={handleGenerateTranscript}
								>
									<Sparkles className="w-4 h-4" />
									Gerar Legendas IA
								</Button>
							</div>
						) : (
							<div className="space-y-3 p-4 rounded-xl border bg-primary/5 border-primary/20">
								<div className="flex items-center justify-between gap-2">
									<span className="text-xs font-bold animate-pulse text-primary">
										{processingStep || "Gerando..."}
									</span>
									<span className="text-[10px] font-mono font-bold text-primary/70">
										{Math.round(processingProgress)}%
									</span>
								</div>
								<Progress value={processingProgress} className="h-2" />
								<Button
									variant="ghost"
									size="sm"
									className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
									onClick={() => {
										setIsCancelled(true);
										transcriptionService.cancel();
									}}
								>
									Cancelar geração
								</Button>
							</div>
						)}

						<p className="text-[10px] text-center text-muted-foreground">
							A transcrição é processada no seu navegador para máxima
							privacidade.
						</p>

						{hasGeneratedTranscript && !isProcessing && (
							<div className="space-y-3 rounded-xl border bg-muted/20 p-3">
								<div className="flex items-center justify-between gap-2">
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Transcrição Gerada
									</p>
									<span className="text-[10px] text-muted-foreground">
										{generatedCaptionChunks.length} blocos
									</span>
								</div>
								<div className="max-h-24 overflow-y-auto rounded-md border bg-background/70 p-2">
									<p className="text-xs leading-relaxed whitespace-pre-wrap">
										{generatedTranscriptText || "Sem texto detectado."}
									</p>
								</div>
								<Button
									className="w-full"
									variant="secondary"
									onClick={handleInsertTranscriptIntoVideo}
									disabled={isInsertingCaptions}
								>
									{isInsertingCaptions ? (
										<Spinner className="mr-2 size-4" />
									) : (
										<Sparkles className="mr-2 h-4 w-4" />
									)}
									Reinserir no vídeo
								</Button>
							</div>
						)}
					</div>
				</TabsContent>

				{/* ── EDITAR ── */}
				<TabsContent value="edit" className="space-y-3 mt-0">
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
							<Input
								placeholder="Buscar na transcrição..."
								className="pl-9 h-9 text-xs"
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setEditPage(1);
								}}
							/>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-9 shrink-0 text-red-500 border-red-300"
							onClick={handleDeleteAutoCaptions}
							title="Remover todas as legendas automáticas"
						>
							<Trash2 className="w-3.5 h-3.5 mr-1" />
							Limpar auto
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="h-9 w-9 shrink-0"
							onClick={handleJumpToCurrent}
							title="Ir para a legenda na playhead"
							disabled={captionElements.length === 0}
						>
							<Play className="w-3.5 h-3.5" />
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-9 w-9 shrink-0"
									title="Exportar legendas"
									disabled={captionElements.length === 0}
								>
									<Download className="w-3.5 h-3.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-36">
								<DropdownMenuLabel>Exportar</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleExportSubtitles("srt")}>
									Baixar .srt
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleExportSubtitles("vtt")}>
									Baixar .vtt
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<ScrollArea className="h-[360px] pr-3 -mr-3">
						<div className="space-y-2">
							{filteredCaptions.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<p className="text-sm">Nenhuma legenda encontrada.</p>
									<p className="text-xs mt-1">
										Gere a transcrição na aba "Gerar".
									</p>
								</div>
							) : (
								paginatedCaptions.map((caption) => (
									<div
										key={caption.id}
										id={`caption-${caption.id}`}
										className="group flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/20 hover:border-primary/40 transition-colors"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
												{formatTime(caption.startTime)}
											</span>
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button
													variant="ghost"
													size="icon"
													className="w-6 h-6 rounded-md hover:bg-primary/20"
													onClick={() => handleSeek(caption.startTime)}
													title="Ir para este momento"
												>
													<Play className="w-3 h-3 text-primary" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="w-6 h-6 rounded-md hover:bg-red-500/20"
													onClick={() =>
														handleDeleteCaption(caption.id, caption.trackId)
													}
													title="Deletar legenda"
												>
													<Trash2 className="w-3 h-3 text-red-500" />
												</Button>
											</div>
										</div>
										<Input
											value={caption.content}
											onChange={(e) =>
												handleUpdateCaption(
													caption.id,
													caption.trackId,
													e.target.value,
												)
											}
											className="h-8 text-xs bg-transparent border-transparent hover:border-muted-foreground/30 focus:border-primary px-1"
										/>
									</div>
								))
							)}
						</div>
					</ScrollArea>

					{/* Paginação */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-1">
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={() => setEditPage((p) => Math.max(1, p - 1))}
								disabled={editPage === 1}
							>
								<ChevronLeft className="w-3.5 h-3.5" />
							</Button>
							<span className="text-xs text-muted-foreground">
								{editPage} / {totalPages}
								<span className="ml-2 text-[10px]">
									({filteredCaptions.length} legendas)
								</span>
							</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={() => setEditPage((p) => Math.min(totalPages, p + 1))}
								disabled={editPage === totalPages}
							>
								<ChevronRight className="w-3.5 h-3.5" />
							</Button>
						</div>
					)}
				</TabsContent>
			</Tabs>
		</PanelView>
	);
}
