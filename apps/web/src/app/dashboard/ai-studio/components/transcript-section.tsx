"use client";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

interface TranscriptSectionProps {
	transcript: string;
	isEditing: boolean;
	isVisible: boolean;
	onToggleVisible: () => void;
	onToggleEditing: () => void;
	onChange: (value: string) => void;
	onDiscard: () => void;
	onSave: () => void;
}

export const TranscriptSection = memo(function TranscriptSection({
	transcript,
	isEditing,
	isVisible,
	onToggleVisible,
	onToggleEditing,
	onChange,
	onDiscard,
	onSave,
}: TranscriptSectionProps) {
	if (!transcript) return null;

	return (
		<div className="border rounded-xl overflow-hidden bg-background">
			<div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
				<button
					type="button"
					className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
					onClick={onToggleVisible}
				>
					<FileText className="w-4 h-4 text-primary" />
					Transcrição e Legendas
					{isVisible ? (
						<ChevronUp className="w-4 h-4 text-muted-foreground" />
					) : (
						<ChevronDown className="w-4 h-4 text-muted-foreground" />
					)}
				</button>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 text-xs gap-1.5"
					onClick={onToggleEditing}
				>
					{isEditing ? "Parar Edição" : "Editar Texto"}
				</Button>
			</div>

			{isVisible && (
				<div className="p-4 space-y-4">
					{isEditing ? (
						<div className="space-y-3">
							<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
								Editor de Transcrição
							</p>
							<textarea
								className="w-full h-48 p-4 text-sm bg-muted/20 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono leading-relaxed"
								value={transcript}
								onChange={(e) => onChange(e.target.value)}
								placeholder="Cole ou edite sua transcrição aqui..."
							/>
							<div className="flex justify-end gap-2">
								<Button size="sm" variant="outline" onClick={onDiscard}>
									Descartar
								</Button>
								<Button size="sm" onClick={onSave}>
									Salvar Alterações
								</Button>
							</div>
						</div>
					) : (
						<div className="text-sm text-muted-foreground leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap font-mono pr-2 custom-scrollbar">
							{transcript}
						</div>
					)}
				</div>
			)}
		</div>
	);
});
