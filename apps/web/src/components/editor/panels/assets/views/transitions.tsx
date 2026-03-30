"use client";

import { useMemo, useRef, useState } from "react";
import { Wand2, Info } from "lucide-react";
import { toast } from "sonner";
import { PanelView } from "./base-view";
import { useEditor } from "@/hooks/use-editor";
import { TRANSITION_DEFINITIONS } from "@/lib/transitions/definitions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

type TransitionPlacement = "in" | "out";

interface TransitionTarget {
	trackId: string;
	elementId: string;
	name: string;
}

export function TransitionsView() {
	const editor = useEditor();
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedTransitionType, setSelectedTransitionType] = useState(
		TRANSITION_DEFINITIONS[0]?.type ?? "",
	);
	const [placement, setPlacement] = useState<TransitionPlacement>("in");
	const [duration, setDuration] = useState(0.5);

	const selectedTransition = useMemo(
		() =>
			TRANSITION_DEFINITIONS.find(
				(transition) => transition.type === selectedTransitionType,
			) ?? TRANSITION_DEFINITIONS[0],
		[selectedTransitionType],
	);

	const getTransitionTargets = (): TransitionTarget[] => {
		const tracks = editor.timeline.getTracks();
		const selectedElements = editor.selection.getSelectedElements();

		const isTransitionTarget = (element: { type: string }) =>
			element.type === "video" || element.type === "image";

		const selectedTargets = selectedElements
			.map((selected) => {
				const track = tracks.find((item) => item.id === selected.trackId);
				const element = track?.elements.find(
					(item) => item.id === selected.elementId,
				);
				if (!track || !element || !isTransitionTarget(element)) return null;
				return {
					trackId: track.id,
					elementId: element.id,
					name: element.name,
				};
			})
			.filter((item): item is TransitionTarget => item !== null);

		if (selectedTargets.length > 0) return selectedTargets;

		const currentTime = editor.playback.getCurrentTime();
		const videoElements = tracks
			.filter((track) => track.type === "video")
			.flatMap((track) =>
				track.elements
					.filter((element) => isTransitionTarget(element))
					.map((element) => ({
						trackId: track.id,
						element,
					})),
			);

		const elementAtPlayhead = videoElements.find(({ element }) => {
			const endTime = element.startTime + element.duration;
			return currentTime >= element.startTime && currentTime <= endTime;
		});

		if (elementAtPlayhead) {
			return [
				{
					trackId: elementAtPlayhead.trackId,
					elementId: elementAtPlayhead.element.id,
					name: elementAtPlayhead.element.name,
				},
			];
		}

		if (videoElements[0]) {
			return [
				{
					trackId: videoElements[0].trackId,
					elementId: videoElements[0].element.id,
					name: videoElements[0].element.name,
				},
			];
		}

		return [];
	};

	const handleApplyTransition = (type: string) => {
		const targets = getTransitionTargets();

		if (targets.length === 0) {
			toast.info(
				"Adicione ou selecione um clip de video na timeline para aplicar a transicao.",
			);
			return;
		}

		targets.forEach((target) => {
			editor.timeline.updateElement({
				trackId: target.trackId,
				elementId: target.elementId,
				patch: {
					...(placement === "in"
						? {
								transitionIn: {
									type,
									duration,
								},
							}
						: {
								transitionOut: {
									type,
									duration,
								},
							}),
				},
			});
		});

		toast.success(
			`Transicao "${type}" aplicada em ${targets.length} clip(s) na ${placement === "in" ? "entrada" : "saida"}.`,
		);
	};

	const transitionTargets = getTransitionTargets();

	return (
		<PanelView title="Transicoes" ref={containerRef}>
			<div className="space-y-4">
				<div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
					<Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Selecione um clip na timeline (ou deixe o playhead sobre ele),
						escolha a transicao e clique em aplicar.
					</p>
				</div>

				{selectedTransition && (
					<div className="rounded-xl border bg-muted/20 p-3 space-y-3">
						<div>
							<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
								Descricao visivel
							</p>
							<h4 className="text-sm font-semibold mt-1">
								{selectedTransition.name}
							</h4>
							<p className="text-xs text-muted-foreground leading-relaxed mt-1">
								{selectedTransition.description}
							</p>
						</div>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								size="sm"
								variant={placement === "in" ? "default" : "outline"}
								className="h-7 text-xs"
								onClick={() => setPlacement("in")}
							>
								Entrada
							</Button>
							<Button
								type="button"
								size="sm"
								variant={placement === "out" ? "default" : "outline"}
								className="h-7 text-xs"
								onClick={() => setPlacement("out")}
							>
								Saida
							</Button>
							<select
								className="h-7 rounded-md border bg-background px-2 text-xs"
								value={duration}
								onChange={(event) => setDuration(Number(event.target.value))}
							>
								<option value={0.3}>0.3s</option>
								<option value={0.5}>0.5s</option>
								<option value={0.8}>0.8s</option>
								<option value={1}>1.0s</option>
							</select>
						</div>

						<div className="space-y-1">
							<Button
								type="button"
								size="sm"
								className="w-full"
								onClick={() =>
									selectedTransition &&
									handleApplyTransition(selectedTransition.type)
								}
							>
								Aplicar transicao selecionada
							</Button>
							<p className="text-[10px] text-muted-foreground">
								{transitionTargets.length > 0
									? `Alvo: ${transitionTargets.map((item) => item.name).join(", ")}`
									: "Nenhum clip alvo encontrado na timeline."}
							</p>
						</div>
					</div>
				)}

				<ScrollArea className="h-[450px] pr-4 -mr-4">
					<div className="grid grid-cols-2 gap-3">
						{TRANSITION_DEFINITIONS.map((transition) => (
							/* biome-ignore lint/a11y/noStaticElementInteractions: card handles click for selection */
							<div
								key={transition.type}
								className={`group relative flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-left ${
									selectedTransitionType === transition.type
										? "border-primary/60 bg-primary/5"
										: ""
								}`}
								onClick={() => setSelectedTransitionType(transition.type)}
								onDoubleClick={() => handleApplyTransition(transition.type)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										setSelectedTransitionType(transition.type);
										handleApplyTransition(transition.type);
									}
								}}
							>
								<div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
									<Wand2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
									<div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<span className="text-[10px] font-bold uppercase tracking-wider text-primary">
											Preview
										</span>
									</div>
								</div>

								<div>
									<h4 className="text-xs font-bold truncate">
										{transition.name}
									</h4>
									<p className="text-[10px] text-muted-foreground line-clamp-2">
										{transition.description}
									</p>
								</div>

								<Button
									type="button"
									size="sm"
									variant={
										selectedTransitionType === transition.type
											? "default"
											: "outline"
									}
									className="h-6 text-[10px]"
									onClick={(event) => {
										event.stopPropagation();
										setSelectedTransitionType(transition.type);
										handleApplyTransition(transition.type);
									}}
								>
									Aplicar
								</Button>
							</div>
						))}
					</div>
				</ScrollArea>
			</div>
		</PanelView>
	);
}
