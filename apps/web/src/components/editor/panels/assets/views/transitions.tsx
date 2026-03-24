"use client";
import { PanelView } from "./base-view";
import { useEditor } from "@/hooks/use-editor";
import { TRANSITION_DEFINITIONS } from "@/lib/transitions/definitions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wand2, Info } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

export function TransitionsView() {
	const editor = useEditor();
	const containerRef = useRef<HTMLDivElement>(null);

	const handleAddTransition = (type: string) => {
		// No editor profissional, a transição é aplicada a um clip selecionado
		// ou entre dois clips. Por enquanto, vamos aplicar ao clip selecionado.
		const selectedElements = editor.selection.getSelectedElements();
		
		if (selectedElements.length === 0) {
			toast.info("Selecione um clip na timeline para aplicar a transição.");
			return;
		}

		selectedElements.forEach((el) => {
			editor.timeline.updateElement({
				trackId: el.trackId,
				elementId: el.elementId,
				patch: {
					transitionIn: {
						type,
						duration: 0.5,
					}
				}
			});
		});

		toast.success(`Transição "${type}" aplicada!`);
	};

	return (
		<PanelView title="Transições" ref={containerRef}>
			<div className="space-y-4">
				<div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
					<Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Selecione um clip na timeline e clique em uma transição para aplicá-la ao início do vídeo.
					</p>
				</div>

				<ScrollArea className="h-[450px] pr-4 -mr-4">
					<div className="grid grid-cols-2 gap-3">
						{TRANSITION_DEFINITIONS.map((transition) => (
							<button
								key={transition.type}
								type="button"
								className="group relative flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
								onClick={() => handleAddTransition(transition.type)}
							>
								<div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
									<Wand2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
									
									{/* Fake preview animation overlay */}
									<div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<span className="text-[10px] font-bold uppercase tracking-wider text-primary">Preview</span>
									</div>
								</div>
								
								<div>
									<h4 className="text-xs font-bold truncate">{transition.name}</h4>
									<p className="text-[10px] text-muted-foreground">0.5s duração</p>
								</div>
							</button>
						))}
					</div>
				</ScrollArea>
			</div>
		</PanelView>
	);
}
