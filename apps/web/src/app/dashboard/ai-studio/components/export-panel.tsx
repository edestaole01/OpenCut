"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	X,
	Download,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Sliders,
	Type,
	Droplets,
	Smartphone,
	Square,
	Monitor,
	ChevronDown,
	ChevronUp,
	Scissors,
	Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	useClipExporter,
	type ColorGradingOpts,
	type CaptionOpts,
	type ExportOptions,
} from "../hooks/use-clip-exporter";
import { useSilenceDetector } from "../hooks/use-silence-detector";

interface Clip {
	id: string;
	title: string;
	start: number;
	end: number;
	score: number;
	tag: string;
	caption: string;
}

interface ExportPanelProps {
	clip: Clip;
	videoFile: File;
	onClose: () => void;
}

const formatTime = (s: number) => {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const COLOR_PRESETS = [
	{ name: "Original", brightness: 0, contrast: 1, saturation: 1 },
	{ name: "Vívido", brightness: 0.05, contrast: 1.2, saturation: 1.5 },
	{ name: "Cinema", brightness: -0.05, contrast: 1.3, saturation: 0.8 },
	{ name: "Frio", brightness: 0, contrast: 1.1, saturation: 0.7 },
	{ name: "Vintage", brightness: 0.05, contrast: 0.9, saturation: 0.6 },
	{ name: "Drama", brightness: -0.1, contrast: 1.5, saturation: 1.2 },
];

const CAPTION_STYLES = [
	{ id: "none", label: "Sem legenda" },
	{ id: "tiktok", label: "TikTok / Reels" },
	{ id: "traditional", label: "Tradicional" },
] as const;

type Section = "format" | "color" | "caption" | "silence" | "watermark";

export function ExportPanel({ clip, videoFile, onClose }: ExportPanelProps) {
	const { exportClip, exportThumbnail, status, error, progress } =
		useClipExporter();
	const {
		detectSilence,
		isAnalyzing,
		result: silenceResult,
	} = useSilenceDetector();

	// Format
	const [format, setFormat] = useState<"original" | "vertical" | "square">(
		"original",
	);

	// Color grading
	const [colorPreset, setColorPreset] = useState(0);
	const [colorGrading, setColorGrading] = useState<ColorGradingOpts>({
		brightness: 0,
		contrast: 1,
		saturation: 1,
	});

	// Caption
	const [captionStyle, setCaptionStyle] =
		useState<CaptionOpts["style"]>("none");
	const [captionText, setCaptionText] = useState(clip.caption);
	const [captionFontSize, setCaptionFontSize] = useState(48);
	const [captionColor, setCaptionColor] = useState("white");

	// Silence
	const [silenceThreshold, setSilenceThreshold] = useState(0.01);
	const [silenceRun, setSilenceRun] = useState(false);

	// Sections open
	const [open, setOpen] = useState<Record<Section, boolean>>({
		format: true,
		color: false,
		caption: false,
		silence: false,
		watermark: false,
	});

	const toggle = (s: Section) =>
		setOpen((prev) => ({ ...prev, [s]: !prev[s] }));

	const applyPreset = (idx: number) => {
		setColorPreset(idx);
		setColorGrading({ ...COLOR_PRESETS[idx] });
	};

	const handleExport = () => {
		const opts: ExportOptions = {
			clip,
			videoFile,
			format,
			colorGrading,
			caption:
				captionStyle !== "none"
					? {
							text: captionText,
							style: captionStyle,
							fontSize: captionFontSize,
							color: captionColor,
						}
					: undefined,
			speechSegments: silenceResult?.speechSegments,
		};
		exportClip(opts);
	};

	const handleThumbnail = () => {
		exportThumbnail(videoFile, clip.start, clip.title);
	};

	const handleSilenceDetect = async () => {
		setSilenceRun(true);
		await detectSilence(videoFile, silenceThreshold, 0.4);
	};

	const isProcessing = status === "loading-ffmpeg" || status === "processing";

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes modal
		<div
			className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
			role="presentation"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="relative w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
				style={{ maxHeight: "92vh" }}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b">
					<div>
						<h3 className="font-semibold text-base">Exportar clip</h3>
						<p className="text-xs text-muted-foreground truncate max-w-[260px]">
							{clip.title}
						</p>
					</div>
					<button
						type="button"
						className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
						onClick={onClose}
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Scrollable content */}
				<div className="overflow-y-auto flex-1">
					{/* ── Formato ── */}
					<SectionHeader
						icon={<Monitor className="w-4 h-4" />}
						label="Formato de saída"
						open={open.format}
						onToggle={() => toggle("format")}
					/>
					{open.format && (
						<div className="px-5 pb-4 grid grid-cols-3 gap-2">
							{[
								{
									id: "original",
									label: "Original",
									icon: <Monitor className="w-5 h-5" />,
								},
								{
									id: "vertical",
									label: "Vertical 9:16",
									icon: <Smartphone className="w-5 h-5" />,
								},
								{
									id: "square",
									label: "Quadrado",
									icon: <Square className="w-5 h-5" />,
								},
							].map((f) => (
								<button
									key={f.id}
									type="button"
									onClick={() => setFormat(f.id as typeof format)}
									className={cn(
										"flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-colors",
										format === f.id
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-muted-foreground/50",
									)}
								>
									{f.icon}
									{f.label}
								</button>
							))}
						</div>
					)}

					{/* ── Color Grading ── */}
					<SectionHeader
						icon={<Droplets className="w-4 h-4" />}
						label="Color Grading"
						open={open.color}
						onToggle={() => toggle("color")}
					/>
					{open.color && (
						<div className="px-5 pb-4 space-y-4">
							{/* Presets */}
							<div className="grid grid-cols-3 gap-2">
								{COLOR_PRESETS.map((p, i) => (
									<button
										key={p.name}
										type="button"
										onClick={() => applyPreset(i)}
										className={cn(
											"py-2 px-3 rounded-lg border text-xs font-medium transition-colors",
											colorPreset === i
												? "border-primary bg-primary/10 text-primary"
												: "border-border hover:bg-muted",
										)}
									>
										{p.name}
									</button>
								))}
							</div>

							{/* Manual sliders */}
							<div className="space-y-3">
								<SliderRow
									label="Brilho"
									value={colorGrading.brightness}
									min={-0.5}
									max={0.5}
									step={0.01}
									onChange={(v) => {
										setColorPreset(-1);
										setColorGrading((c) => ({ ...c, brightness: v }));
									}}
								/>
								<SliderRow
									label="Contraste"
									value={colorGrading.contrast}
									min={0.5}
									max={2.5}
									step={0.05}
									onChange={(v) => {
										setColorPreset(-1);
										setColorGrading((c) => ({ ...c, contrast: v }));
									}}
								/>
								<SliderRow
									label="Saturação"
									value={colorGrading.saturation}
									min={0}
									max={3}
									step={0.05}
									onChange={(v) => {
										setColorPreset(-1);
										setColorGrading((c) => ({ ...c, saturation: v }));
									}}
								/>
							</div>
						</div>
					)}

					{/* ── Caption ── */}
					<SectionHeader
						icon={<Type className="w-4 h-4" />}
						label="Legenda (Burn-in)"
						open={open.caption}
						onToggle={() => toggle("caption")}
					/>
					{open.caption && (
						<div className="px-5 pb-4 space-y-3">
							{/* Style tabs */}
							<div className="flex gap-2">
								{CAPTION_STYLES.map((s) => (
									<button
										key={s.id}
										type="button"
										onClick={() => setCaptionStyle(s.id)}
										className={cn(
											"flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors",
											captionStyle === s.id
												? "border-primary bg-primary/10 text-primary"
												: "border-border hover:bg-muted",
										)}
									>
										{s.label}
									</button>
								))}
							</div>

							{captionStyle !== "none" && (
								<>
									<div>
										<Label className="text-xs text-muted-foreground mb-1 block">
											Texto da legenda
										</Label>
										<Textarea
											value={captionText}
											onChange={(e) => setCaptionText(e.target.value)}
											rows={2}
											className="text-sm resize-none"
											placeholder="Texto que vai aparecer no vídeo..."
										/>
									</div>
									<SliderRow
										label="Tamanho da fonte"
										value={captionFontSize}
										min={24}
										max={96}
										step={4}
										onChange={setCaptionFontSize}
										displayValue={`${captionFontSize}px`}
									/>
									<div>
										<Label className="text-xs text-muted-foreground mb-1.5 block">
											Cor do texto
										</Label>
										<div className="flex gap-2">
											{["white", "yellow", "#00ff00", "red", "#1DA1F2"].map(
												(c) => (
													<button
														key={c}
														type="button"
														onClick={() => setCaptionColor(c)}
														className={cn(
															"w-8 h-8 rounded-full border-2 transition-transform",
															captionColor === c
																? "border-primary scale-110"
																: "border-transparent",
														)}
														style={{ background: c }}
													/>
												),
											)}
										</div>
									</div>
								</>
							)}
						</div>
					)}

					{/* ── Silence Removal ── */}
					<SectionHeader
						icon={<Scissors className="w-4 h-4" />}
						label="Remover silêncios"
						open={open.silence}
						onToggle={() => toggle("silence")}
					/>
					{open.silence && (
						<div className="px-5 pb-4 space-y-3">
							<SliderRow
								label="Sensibilidade"
								value={silenceThreshold}
								min={0.005}
								max={0.1}
								step={0.005}
								onChange={setSilenceThreshold}
								displayValue={silenceThreshold.toFixed(3)}
							/>
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-2"
								onClick={handleSilenceDetect}
								disabled={isAnalyzing}
							>
								{isAnalyzing ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										Analisando áudio...
									</>
								) : (
									<>
										<Sliders className="w-4 h-4" />
										Detectar silêncios
									</>
								)}
							</Button>

							{silenceResult && silenceRun && (
								<div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
									<p className="text-xs font-semibold text-foreground">
										{silenceResult.silentSegments.length} trecho(s)
										silencioso(s) encontrado(s)
									</p>
									<p className="text-xs text-muted-foreground">
										Silêncio total: {silenceResult.totalSilence.toFixed(1)}s •
										Fala: {silenceResult.totalSpeech.toFixed(1)}s
									</p>
									<div className="max-h-32 overflow-y-auto space-y-1 mt-2">
										{silenceResult.silentSegments.map((seg) => (
											<div
												key={`${seg.start}-${seg.end}`}
												className="flex items-center justify-between text-xs bg-background rounded-lg px-3 py-1.5"
											>
												<span className="text-muted-foreground">
													{formatTime(seg.start)} → {formatTime(seg.end)}
												</span>
												<span className="font-medium text-red-500">
													−{seg.duration.toFixed(1)}s
												</span>
											</div>
										))}
									</div>
									{silenceResult.silentSegments.length > 0 && (
										<p className="text-xs text-muted-foreground italic">
											* A remoção de silêncio será aplicada no export
										</p>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer — actions */}
				<div className="border-t px-5 py-4 space-y-3">
					{/* Status bar */}
					{isProcessing && (
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span className="flex items-center gap-1.5">
									<Loader2 className="w-3.5 h-3.5 animate-spin" />
									{status === "loading-ffmpeg"
										? "Carregando processador de vídeo..."
										: "Processando clip..."}
								</span>
								<span>{progress}%</span>
							</div>
							<div className="h-1.5 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all rounded-full"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
					)}
					{status === "done" && (
						<div className="flex items-center gap-2 text-sm text-green-600 font-medium">
							<CheckCircle2 className="w-4 h-4" />
							Download iniciado!
						</div>
					)}
					{status === "error" && error && (
						<div className="flex items-center gap-2 text-sm text-red-500">
							<AlertCircle className="w-4 h-4" />
							{error}
						</div>
					)}

					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 px-3"
							onClick={handleThumbnail}
							disabled={isProcessing}
							title="Baixar thumbnail"
						>
							<Camera className="w-4 h-4" />
							Thumbnail
						</Button>
						<Button
							className="flex-1 gap-2"
							onClick={handleExport}
							disabled={isProcessing}
						>
							{isProcessing ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									Processando...
								</>
							) : (
								<>
									<Download className="w-4 h-4" />
									Exportar clip
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Helper components ──────────────────────────────────────────────────────────

function SectionHeader({
	icon,
	label,
	open,
	onToggle,
}: {
	icon: React.ReactNode;
	label: string;
	open: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors border-b"
			onClick={onToggle}
		>
			<div className="flex items-center gap-2 text-sm font-medium">
				<span className="text-primary">{icon}</span>
				{label}
			</div>
			{open ? (
				<ChevronUp className="w-4 h-4 text-muted-foreground" />
			) : (
				<ChevronDown className="w-4 h-4 text-muted-foreground" />
			)}
		</button>
	);
}

function SliderRow({
	label,
	value,
	min,
	max,
	step,
	onChange,
	displayValue,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
	displayValue?: string;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between">
				<Label className="text-xs text-muted-foreground">{label}</Label>
				<span className="text-xs font-mono font-medium">
					{displayValue ?? value.toFixed(2)}
				</span>
			</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={([v]) => onChange(v)}
				className="h-1.5"
			/>
		</div>
	);
}
