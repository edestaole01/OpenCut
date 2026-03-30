import type React from "react";
import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT, DEFAULT_TEXT_BACKGROUND, FONT_SIZE_SCALE_REFERENCE } from "@/constants/text-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { cn } from "@/utils/ui";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FontPicker } from "@/components/ui/font-picker";
import type { TextElement } from "@/types/timeline";

type TextPreset = {
	id: string;
	name: string;
	overrides: Partial<Omit<TextElement, "id" | "type" | "startTime" | "duration" | "trimStart" | "trimEnd" | "transform" | "opacity" | "animations" | "effects">>;
	preview: {
		fontSize: number;
		color: string;
		fontWeight?: string;
		fontStyle?: string;
		background?: string;
		padding?: string;
		borderRadius?: string;
		letterSpacing?: string;
		textTransform?: string;
	};
};

const TEXT_PRESETS: TextPreset[] = [
	{
		id: "default",
		name: "Padrão",
		overrides: {
			content: "Texto padrão",
			fontSize: 15,
			fontFamily: "Arial",
			color: "#ffffff",
			fontWeight: "normal",
		},
		preview: { fontSize: 13, color: "#ffffff", fontWeight: "normal" },
	},
	{
		id: "title",
		name: "Título",
		overrides: {
			content: "Título Principal",
			fontSize: 28,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "bold",
			textTransform: "uppercase",
			letterSpacing: 2,
		},
		preview: { fontSize: 15, color: "#ffffff", fontWeight: "900", letterSpacing: "2px", textTransform: "uppercase" },
	},
	{
		id: "subtitle",
		name: "Subtítulo",
		overrides: {
			content: "Subtítulo aqui",
			fontSize: 18,
			fontFamily: "Inter",
			color: "#cccccc",
			fontWeight: "normal",
			fontStyle: "italic",
		},
		preview: { fontSize: 12, color: "#cccccc", fontStyle: "italic" },
	},
	{
		id: "highlight",
		name: "Destaque",
		overrides: {
			content: "DESTAQUE",
			fontSize: 22,
			fontFamily: "Inter",
			color: "#000000",
			fontWeight: "bold",
			textTransform: "uppercase",
			background: {
				enabled: true,
				color: "#ffffff",
				cornerRadius: 4,
				paddingX: 24,
				paddingY: 12,
				offsetX: 0,
				offsetY: 0,
			},
		},
		preview: { fontSize: 11, color: "#000000", fontWeight: "900", background: "#ffffff", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase" },
	},
	{
		id: "neon",
		name: "Neon",
		overrides: {
			content: "NEON",
			fontSize: 24,
			fontFamily: "Inter",
			color: "#00ff88",
			fontWeight: "bold",
			textTransform: "uppercase",
			letterSpacing: 4,
		},
		preview: { fontSize: 13, color: "#00ff88", fontWeight: "900", letterSpacing: "3px", textTransform: "uppercase" },
	},
	{
		id: "gold",
		name: "Ouro",
		overrides: {
			content: "Premium",
			fontSize: 22,
			fontFamily: "Inter",
			color: "#f5c518",
			fontWeight: "bold",
			fontStyle: "italic",
			letterSpacing: 1,
		},
		preview: { fontSize: 13, color: "#f5c518", fontWeight: "900", fontStyle: "italic", letterSpacing: "1px" },
	},
	{
		id: "quote",
		name: "Citação",
		overrides: {
			content: '"Uma frase inspiradora que\nmuda perspectivas."',
			fontSize: 16,
			fontFamily: "Georgia",
			color: "#ffffff",
			fontStyle: "italic",
			lineHeight: 1.5,
		},
		preview: { fontSize: 10, color: "#ffffff", fontStyle: "italic" },
	},
	{
		id: "lower-third",
		name: "Lower Third",
		overrides: {
			content: "Nome Sobrenome",
			fontSize: 14,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "normal",
			background: {
				enabled: true,
				color: "#1a73e8",
				cornerRadius: 2,
				paddingX: 20,
				paddingY: 10,
				offsetX: 0,
				offsetY: 0,
			},
		},
		preview: { fontSize: 10, color: "#ffffff", background: "#1a73e8", padding: "2px 6px", borderRadius: "2px" },
	},
	{
		id: "minimal",
		name: "Minimal",
		overrides: {
			content: "texto simples",
			fontSize: 14,
			fontFamily: "Inter",
			color: "#ffffff",
			fontWeight: "normal",
			textTransform: "lowercase",
			letterSpacing: 3,
		},
		preview: { fontSize: 10, color: "#ffffff", letterSpacing: "2px", textTransform: "lowercase" },
	},
];

const TEXT_CASE_OPTIONS = [
	{ value: "none", label: "Aa", title: "Original" },
	{ value: "uppercase", label: "AA", title: "MAIÚSCULO" },
	{ value: "lowercase", label: "aa", title: "minúsculo" },
	{ value: "capitalize", label: "Ab", title: "Primeira Letra" },
	{ value: "sentence", label: "A.", title: "Início de Frase" },
] as const;

type TextCase = (typeof TEXT_CASE_OPTIONS)[number]["value"];

export function TextView() {
	const editor = useEditor();

	const activeProject = editor.project.getActive();
	const canvasHeight = activeProject?.settings.canvasSize.height ?? 1920;

	// fontSize relativo (mesmo sistema das legendas)
	const [fontSizeRelative, setFontSizeRelative] = useState(15);
	const fontSizePx = Math.round(fontSizeRelative * (canvasHeight / FONT_SIZE_SCALE_REFERENCE));

	const [textColor, setTextColor] = useState("#ffffff");
	const [fontFamily, setFontFamily] = useState("Arial");
	const [textCase, setTextCase] = useState<TextCase>("none");
	const [customText, setCustomText] = useState("");

	const handleAddPreset = (preset: TextPreset) => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		const currentTime = editor.playback.getCurrentTime();

		const element = buildTextElement({
			raw: {
				...DEFAULT_TEXT_ELEMENT,
				...preset.overrides,
				name: preset.name,
				// Aplica as customizações do usuário sobre o preset
				content: customText.trim() || preset.overrides.content,
				fontSize: fontSizeRelative,
				color: textColor,
				fontFamily,
				textTransform: textCase,
				background: preset.overrides.background ?? DEFAULT_TEXT_BACKGROUND,
			} as Parameters<typeof buildTextElement>[0]["raw"],
			startTime: currentTime,
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	return (
		<PanelView title="Texto">
			<div className="flex flex-col gap-4 p-3 pb-2">
				{/* Conteúdo do texto */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Conteúdo
					</Label>
					<Textarea
						placeholder="Ex: Bem-vindo ao canal!"
						value={customText}
						onChange={(e) => setCustomText(e.target.value)}
						className="min-h-16 resize-none text-sm"
					/>
				<p className="text-[11px] text-muted-foreground">Se vazio, usa o texto padrão do estilo escolhido.</p>
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
							onClick={() => setFontSizeRelative((v) => Math.max(1, Math.round((v - 1) * 10) / 10))}
							disabled={fontSizeRelative <= 1}
						>
							−
						</Button>
						<Slider
							min={1}
							max={60}
							step={1}
							value={[fontSizeRelative]}
							onValueChange={([v]) => setFontSizeRelative(v)}
							className="flex-1"
						/>
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8 shrink-0"
							onClick={() => setFontSizeRelative((v) => Math.min(60, Math.round((v + 1) * 10) / 10))}
							disabled={fontSizeRelative >= 60}
						>
							+
						</Button>
					</div>
				</div>

				{/* Cor e Fonte */}
				<div className="flex gap-3">
					<div className="flex flex-col gap-2 flex-1">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Cor
						</Label>
						<div className="flex items-center gap-2">
							<div
								className="relative h-9 w-9 shrink-0 rounded-md border border-border overflow-hidden cursor-pointer"
								style={{ backgroundColor: textColor }}
							>
								<input
									type="color"
									value={textColor}
									onChange={(e) => setTextColor(e.target.value)}
									className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
								/>
							</div>
							<span className="text-xs font-mono text-muted-foreground">{textColor}</span>
						</div>
					</div>
					<div className="flex flex-col gap-2 flex-1 min-w-0">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Fonte
						</Label>
						<FontPicker
							defaultValue={fontFamily}
							onValueChange={setFontFamily}
						/>
					</div>
				</div>

				{/* Caixa do texto */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Caixa do Texto
					</Label>
					<div className="flex gap-1">
						{TEXT_CASE_OPTIONS.map(({ value, label, title }) => (
							<Button
								key={value}
								variant={textCase === value ? "default" : "outline"}
								size="sm"
								className="flex-1 h-8 px-0 text-xs font-mono"
								title={title}
								onClick={() => setTextCase(value)}
							>
								{label}
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* Separador com instrução */}
			<div className="flex items-center gap-2 px-3">
				<div className="h-px flex-1 bg-border" />
				<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
					Clique para adicionar
				</span>
				<div className="h-px flex-1 bg-border" />
			</div>

			{/* Presets */}
			<div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
				{TEXT_PRESETS.map((preset) => (
					<button
						key={preset.id}
						className={cn(
							"flex flex-col items-center gap-1 rounded-lg border border-border p-1.5 transition-all hover:bg-accent hover:border-primary/40 group cursor-pointer",
						)}
						onClick={() => handleAddPreset(preset)}
						title={`Adicionar ${preset.name}`}
					>
						<div
							className="flex h-10 w-full items-center justify-center rounded-md overflow-hidden"
							style={{ background: "hsl(var(--muted))" }}
						>
							<span
								style={{
									fontSize: `${preset.preview.fontSize}px`,
									color: textColor !== "#ffffff" ? textColor : preset.preview.color,
									fontWeight: preset.preview.fontWeight ?? "normal",
									fontStyle: preset.preview.fontStyle ?? "normal",
									backgroundColor: preset.preview.background,
									padding: preset.preview.padding,
									borderRadius: preset.preview.borderRadius,
									letterSpacing: preset.preview.letterSpacing,
									textTransform: (textCase !== "none" ? textCase : preset.preview.textTransform) as React.CSSProperties["textTransform"],
									whiteSpace: "nowrap",
									maxWidth: "100%",
									overflow: "hidden",
									textOverflow: "ellipsis",
									fontFamily: fontFamily !== "Arial" ? fontFamily : undefined,
								}}
							>
								{preset.name}
							</span>
						</div>
						<span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors leading-none">
							{preset.name}
						</span>
					</button>
				))}
			</div>
		</PanelView>
	);
}
