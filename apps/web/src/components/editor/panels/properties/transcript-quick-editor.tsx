import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";

interface TranscriptTarget {
	trackId: string;
	elementId: string;
	name: string;
	content: string;
	startTime: number;
	duration: number;
	template: Record<string, unknown>;
}

type TimelineLike = Array<{
	id: string;
	type: string;
	elements: Array<{
		id: string;
		type: string;
		name?: string;
		content?: string;
		startTime: number;
		duration: number;
	}>;
}>;

function normalizeText(value: string | undefined): string {
	return (value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function isTemplateTranscript(content: string | undefined): boolean {
	const normalized = normalizeText(content);
	return (
		normalized === "default text" ||
		normalized === "cole ou edite a transcricao aqui." ||
		normalized === "cole ou edite a transcricao aqui"
	);
}

function findTranscriptTarget({
	tracks,
	selectedElements,
}: {
	tracks: TimelineLike;
	selectedElements: Array<{ trackId: string; elementId: string }>;
}): TranscriptTarget | null {
	for (const selected of selectedElements) {
		const track = tracks.find((item) => item.id === selected.trackId);
		const element = track?.elements.find(
			(item) => item.id === selected.elementId,
		);
		if (!track || !element) continue;
		if (element.type === "text") {
			return {
				trackId: track.id,
				elementId: element.id,
				name: element.name ?? "",
				content: typeof element.content === "string" ? element.content : "",
				startTime: element.startTime,
				duration: element.duration,
				template: element as unknown as Record<string, unknown>,
			};
		}
	}

	const textElements = tracks
		.filter((track) => track.type === "text")
		.flatMap((track) =>
			track.elements
				.filter(
					(element) =>
						element.type === "text" && !isTemplateTranscript(element.content),
				)
				.map((element) => ({
					trackId: track.id,
					elementId: element.id,
					name: element.name ?? "",
					content: typeof element.content === "string" ? element.content : "",
					startTime: element.startTime,
					duration: element.duration,
					template: element as unknown as Record<string, unknown>,
				})),
		);

	if (textElements.length === 0) return null;

	const prioritized =
		textElements.find((element) => {
			const normalized = normalizeText(element.name);
			return (
				normalized.includes("legenda") ||
				normalized.includes("caption") ||
				normalized.includes("transcricao") ||
				normalized.includes("subtitle")
			);
		}) ?? textElements[0];

	return {
		trackId: prioritized.trackId,
		elementId: prioritized.elementId,
		name: prioritized.name,
		content: prioritized.content,
		startTime: prioritized.startTime,
		duration: prioritized.duration,
		template: prioritized.template,
	};
}

function buildCaptionChunksFromTranscript(text: string): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const words = normalized.split(" ");
	const chunks: string[] = [];
	let current = "";

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length <= 28) {
			current = candidate;
			continue;
		}

		if (current) chunks.push(current);
		current = word;
	}

	if (current) chunks.push(current);
	return chunks.filter(Boolean);
}

export function TranscriptQuickEditor() {
	const editor = useEditor();
	const params = useParams<{ project_id?: string }>();
	const projectId =
		typeof params?.project_id === "string" ? params.project_id : "";
	const { selectedElements } = useElementSelection();
	const tracks = editor.timeline.getTracks() as unknown as TimelineLike;
	const [seedTranscript, setSeedTranscript] = useState("");

	const transcriptTarget = useMemo(
		() => findTranscriptTarget({ tracks, selectedElements }),
		[tracks, selectedElements],
	);
	const [draftTranscript, setDraftTranscript] = useState("");

	useEffect(() => {
		if (!projectId || typeof window === "undefined") {
			setSeedTranscript("");
			return;
		}

		const raw = window.sessionStorage.getItem(
			`opencut:project-transcript:${projectId}`,
		);
		setSeedTranscript(raw?.trim() ?? "");
	}, [projectId]);

	useEffect(() => {
		const current = transcriptTarget?.content ?? "";
		if (isTemplateTranscript(current) && seedTranscript) {
			setDraftTranscript(seedTranscript);
			return;
		}

		setDraftTranscript(current);
	}, [transcriptTarget?.content, seedTranscript]);

	useEffect(() => {
		if (!transcriptTarget || !seedTranscript) return;
		if (!isTemplateTranscript(transcriptTarget.content)) return;

		editor.timeline.updateElement({
			trackId: transcriptTarget.trackId,
			elementId: transcriptTarget.elementId,
			patch: { content: seedTranscript },
		});
	}, [editor, transcriptTarget, seedTranscript]);

	const handleSaveTranscript = () => {
		if (!transcriptTarget) {
			toast.info("Nenhuma camada de texto encontrada para salvar.");
			return;
		}

		editor.timeline.updateElement({
			trackId: transcriptTarget.trackId,
			elementId: transcriptTarget.elementId,
			patch: { content: draftTranscript },
		});

		editor.selection.setSelectedElements({
			elements: [
				{
					trackId: transcriptTarget.trackId,
					elementId: transcriptTarget.elementId,
				},
			],
		});

		toast.success("Transcricao atualizada na timeline.");
	};

	const handleGenerateCaptionFromTranscript = () => {
		if (!transcriptTarget) {
			toast.info("Selecione uma camada de texto para gerar legendas.");
			return;
		}

		const chunks = buildCaptionChunksFromTranscript(draftTranscript);
		if (chunks.length === 0) {
			toast.info("Digite a transcricao antes de gerar as legendas.");
			return;
		}

		const baseDuration = Math.max(1, transcriptTarget.duration);
		const chunkDuration = Math.max(0.6, baseDuration / chunks.length);
		const baseStartTime = transcriptTarget.startTime;
		const template = transcriptTarget.template as Record<string, unknown>;

		editor.timeline.deleteElements({
			elements: [
				{
					trackId: transcriptTarget.trackId,
					elementId: transcriptTarget.elementId,
				},
			],
		});

		chunks.forEach((content, index) => {
			const startTime = baseStartTime + index * chunkDuration;
			const remaining = baseStartTime + baseDuration - startTime;
			const duration = Math.max(0.5, Math.min(chunkDuration, remaining));
			if (duration <= 0) return;

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: transcriptTarget.trackId },
				element: {
					type: "text",
					name: `Caption ${index + 1}`,
					content,
					startTime,
					duration,
					trimStart: 0,
					trimEnd: 0,
					fontSize: (template.fontSize as number) ?? 3.8,
					fontFamily: (template.fontFamily as string) ?? "Inter",
					color: (template.color as string) ?? "#ffffff",
					textAlign: (template.textAlign as string) ?? "center",
					fontWeight: (template.fontWeight as string) ?? "bold",
					fontStyle: (template.fontStyle as string) ?? "normal",
					textDecoration: (template.textDecoration as string) ?? "none",
					lineHeight: (template.lineHeight as number) ?? 1.15,
					letterSpacing: (template.letterSpacing as number) ?? 0,
					transform: (template.transform as Record<string, unknown>) ?? {
						position: { x: 0, y: 520 },
						scale: 1,
						rotate: 0,
					},
					opacity: (template.opacity as number) ?? 1,
					background: (template.background as Record<string, unknown>) ?? {
						enabled: true,
						color: "rgba(0,0,0,0.72)",
						cornerRadius: 12,
						paddingX: 40,
						paddingY: 22,
						offsetX: 0,
						offsetY: 0,
					},
				} as unknown as Parameters<typeof buildTextElement>[0]["raw"],
			});
		});

		toast.success("Legendas geradas a partir da transcricao.");
	};

	const handleCreateTranscriptLayer = () => {
		const firstVideo = tracks
			.filter((track) => track.type === "video")
			.flatMap((track) =>
				track.elements.map((element) => ({
					trackId: track.id,
					element,
				})),
			)
			.find(
				(item) =>
					item.element.type === "video" || item.element.type === "image",
			);

		if (!firstVideo) {
			toast.info("Adicione um video antes de criar a transcricao.");
			return;
		}

		const existingTextTrack = tracks.find((track) => track.type === "text");
		const textTrackId =
			existingTextTrack?.id ?? editor.timeline.addTrack({ type: "text" });
		const startTime = firstVideo.element.startTime;
		const duration = Math.max(1, firstVideo.element.duration);
		const initialContent = seedTranscript || "";

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId: textTrackId },
			element: {
				type: "text",
				name: "Transcricao AI",
				content: initialContent,
				startTime,
				duration,
				trimStart: 0,
				trimEnd: 0,
				fontSize: 3.8,
				fontFamily: "Inter",
				color: "#ffffff",
				textAlign: "center",
				fontWeight: "bold",
				fontStyle: "normal",
				textDecoration: "none",
				lineHeight: 1.15,
				letterSpacing: 0,
				transform: { position: { x: 0, y: 520 }, scale: 1, rotate: 0 },
				opacity: 1,
				background: {
					enabled: true,
					color: "rgba(0,0,0,0.72)",
					cornerRadius: 12,
					paddingX: 40,
					paddingY: 22,
					offsetX: 0,
					offsetY: 0,
				},
			},
		});

		toast.success("Camada de transcricao criada. Agora voce pode editar.");
	};

	return (
		<div className="rounded-xl border bg-muted/20 p-3 space-y-2">
			<p className="text-xs font-semibold">Transcricao rapida</p>
			{transcriptTarget ? (
				<>
					<p className="text-[11px] text-muted-foreground">
						Editando camada:{" "}
						<span className="font-medium text-foreground">
							{transcriptTarget.name || "Texto"}
						</span>
					</p>
					<textarea
						className="w-full min-h-28 rounded-md border bg-background p-2 text-xs"
						value={draftTranscript}
						onChange={(event) => setDraftTranscript(event.target.value)}
						placeholder="Edite a transcricao aqui..."
					/>
					<div className="flex gap-2">
						<Button
							size="sm"
							className="h-7 text-xs"
							onClick={handleSaveTranscript}
						>
							Salvar na timeline
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs"
							onClick={handleGenerateCaptionFromTranscript}
						>
							Gerar legenda
						</Button>
					</div>
				</>
			) : (
				<div className="space-y-2">
					<p className="text-[11px] text-muted-foreground">
						Ainda nao encontramos uma camada de transcricao neste projeto.
					</p>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs"
						onClick={handleCreateTranscriptLayer}
					>
						Criar camada de transcricao
					</Button>
				</div>
			)}
		</div>
	);
}
