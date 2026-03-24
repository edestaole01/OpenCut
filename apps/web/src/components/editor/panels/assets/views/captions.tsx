import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useMemo } from "react";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { TRANSCRIPTION_LANGUAGES } from "@/constants/transcription-constants";
import type {
	TranscriptionLanguage,
	TranscriptionProgress,
} from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Play, Edit3, Trash2, Languages, Sparkles } from "lucide-react";

import { CAPTION_PRESETS, } from "@/constants/caption-presets";
import { cn } from "@/utils/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [selectedPresetId, setSelectedPresetId] = useState<string>(CAPTION_PRESETS[0].id);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const editor = useEditor();

	const selectedPreset = CAPTION_PRESETS.find(p => p.id === selectedPresetId) ?? CAPTION_PRESETS[0];

	// Get all text elements from the timeline for editing
	const tracks = editor.timeline.getTracks();
	const captionElements = tracks
		.filter((track) => track.type === "text")
		.flatMap((track) =>
			track.elements.map((element) => ({ ...element, trackId: track.id })),
		)
		.sort((a, b) => a.startTime - b.startTime);

	const filteredCaptions = useMemo(() => {
		if (!searchQuery.trim()) return captionElements;
		return captionElements.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
	}, [captionElements, searchQuery]);

	const formatTime = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, "0")}`;
	};

	const handleProgress = (progress: TranscriptionProgress) => {
		setProcessingStep(`${progress.status}: ${Math.round(progress.progress)}%`);
	};

	const handleUpdateCaption = (id: string, trackId: string, content: string) => {
		editor.timeline.updateElement({
			trackId,
			elementId: id,
			patch: { content },
		});
	};

	const handleDeleteCaption = (id: string, trackId: string) => {
		editor.timeline.deleteElements({
			elements: [{ trackId, elementId: id }],
		});
	};

	const handleSeek = (time: number) => {
		editor.playback.seek({ time });
	};

	const handleGenerateTranscript = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setProcessingStep("Extracting audio...");

			const audioBlob = await extractTimelineAudio({
				tracks: editor.timeline.getTracks(),
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
			});

			setProcessingStep("Preparing audio...");
			const { samples } = await decodeAudioToFloat32({ audioBlob });

			const result = await transcriptionService.transcribe({
				audioData: samples,
				language: selectedLanguage === "auto" ? undefined : selectedLanguage,
				onProgress: handleProgress,
			});

			setProcessingStep("Generating captions...");
			
			// Custom chunking for Hormozi style (word-by-word)
			const isHormozi = selectedPresetId === "hormozi";
			const wordsPerChunk = isHormozi ? 1 : 3;
			
			const captionChunks = buildCaptionChunks({ 
				segments: result.segments,
				wordsPerChunk: wordsPerChunk
			});

			const captionTrackId = editor.timeline.addTrack({
				type: "text",
				index: 0,
			});

			for (let i = 0; i < captionChunks.length; i++) {
				const caption = captionChunks[i];
				let content = caption.text;
				
				if (selectedPreset.styles.textCase === "uppercase") {
					content = content.toUpperCase();
				}

				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: captionTrackId },
					element: {
						...DEFAULT_TEXT_ELEMENT,
						name: `Caption ${i + 1}`,
						content,
						duration: caption.duration,
						startTime: caption.startTime,
						fontSize: selectedPreset.styles.fontSize,
						fontWeight: selectedPreset.styles.fontWeight,
						color: selectedPreset.styles.color,
						background: { 
							enabled: !isHormozi, // Hormozi doesn't use background usually
							color: "rgba(0,0,0,0.4)", 
							paddingX: 8, 
							paddingY: 4, 
							cornerRadius: 4 
						},
						textAlign: "center",
						transform: { x: 0, y: isHormozi ? 120 : 180, scale: 1, rotation: 0 },
						// Add shadow/stroke for Hormozi
						...(isHormozi ? {
							strokeColor: "#000000",
							strokeWidth: 4,
						} : {})
					} as any,
				});
			}
		} catch (error) {
			console.error("Transcription failed:", error);
			setError(
				error instanceof Error ? error.message : "An unexpected error occurred",
			);
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
		}
	};

	return (
		<PanelView title="Captions & Subtitles" ref={containerRef}>
			<Tabs defaultValue="generate" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-4">
					<TabsTrigger value="generate" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Gerar</TabsTrigger>
					<TabsTrigger value="edit" className="gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Editar</TabsTrigger>
				</TabsList>

				<TabsContent value="generate" className="space-y-6 mt-0">
					<div className="flex flex-col gap-3">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estilo das Legendas</Label>
						<div className="grid grid-cols-2 gap-2">
							{CAPTION_PRESETS.map((preset) => (
								<button
									key={preset.id}
									type="button"
									className={cn(
										"flex flex-col items-center gap-2 rounded-xl border p-3 transition-all hover:bg-accent group",
										selectedPresetId === preset.id ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-border"
									)}
									onClick={() => setSelectedPresetId(preset.id)}
								>
									<div 
										className="flex h-12 w-full items-center justify-center rounded-lg bg-muted/50 text-xs font-bold shadow-inner group-hover:scale-105 transition-transform"
										style={{ 
											color: preset.styles.color,
											fontSize: "14px",
											textTransform: preset.styles.textCase === "uppercase" ? "uppercase" : "none"
										}}
									>
										{preset.name.split(' ')[0]}
									</div>
									<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{preset.name}</span>
								</button>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Idioma do Áudio</Label>
						<Select
							value={selectedLanguage}
							onValueChange={(value) =>
								setSelectedLanguage(value as TranscriptionLanguage)
							}
						>
							<SelectTrigger className="bg-muted/30 border-muted-foreground/20">
								<Languages className="w-4 h-4 mr-2 text-muted-foreground" />
								<SelectValue placeholder="Auto detectar" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="auto">Auto detectar (Recomendado)</SelectItem>
								{TRANSCRIPTION_LANGUAGES.map((language) => (
									<SelectItem key={language.code} value={language.code}>
										{language.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-4">
						{error && (
							<div className="bg-red-500/10 border-red-500/20 rounded-lg border p-3">
								<p className="text-red-500 text-xs font-medium">{error}</p>
							</div>
						)}

						<Button
							className="w-full h-11 font-bold gap-2 shadow-lg shadow-primary/20"
							onClick={handleGenerateTranscript}
							disabled={isProcessing}
						>
							{isProcessing ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
							{isProcessing ? processingStep : "Gerar Legendas IA"}
						</Button>
						<p className="text-[10px] text-center text-muted-foreground">A transcrição é processada no seu navegador para máxima privacidade.</p>
					</div>
				</TabsContent>

				<TabsContent value="edit" className="space-y-4 mt-0">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
						<Input 
							placeholder="Buscar na transcrição..." 
							className="pl-9 h-9 text-xs"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
					</div>

					<ScrollArea className="h-[400px] pr-4 -mr-4">
						<div className="space-y-3">
							{filteredCaptions.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<p className="text-sm">Nenhuma legenda encontrada.</p>
									<p className="text-xs mt-1">Gere a transcrição na aba "Gerar".</p>
								</div>
							) : (
								filteredCaptions.map((caption) => (
									<div key={caption.id} className="group flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/20 hover:border-primary/40 transition-colors">
										<div className="flex items-center justify-between gap-2">
											<span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
												{formatTime(caption.startTime)}
											</span>
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button 
													variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-primary/20"
													onClick={() => handleSeek(caption.startTime)}
												>
													<Play className="w-3 h-3 text-primary" />
												</Button>
												<Button 
													variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-red-500/20"
													onClick={() => handleDeleteCaption(caption.id, caption.trackId)}
												>
													<Trash2 className="w-3 h-3 text-red-500" />
												</Button>
											</div>
										</div>
										<Input 
											value={caption.content}
											onChange={(e) => handleUpdateCaption(caption.id, caption.trackId, e.target.value)}
											className="h-8 text-xs bg-transparent border-transparent hover:border-muted-foreground/30 focus:border-primary px-1"
										/>
									</div>
								))
							)}
						</div>
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</PanelView>
	);
}

