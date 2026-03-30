import { HugeiconsIcon } from "@hugeicons/react";
import {
	CloudUploadIcon,
	Video01Icon,
	MusicNote01Icon,
	Image01Icon,
} from "@hugeicons/core-free-icons";

interface MediaDragOverlayProps {
	isVisible: boolean;
	isProcessing?: boolean;
	progress?: number;
	onClick?: () => void;
}

export function MediaDragOverlay({
	isVisible,
	isProcessing = false,
	progress = 0,
	onClick,
}: MediaDragOverlayProps) {
	if (!isVisible) return null;

	const handleClick = ({
		event,
	}: {
		event: React.MouseEvent<HTMLButtonElement>;
	}) => {
		if (isProcessing || !onClick) return;
		event.preventDefault();
		event.stopPropagation();
		onClick();
	};

	return (
		<button
			className="hover:bg-accent/40 flex size-full flex-col items-center justify-center gap-5 rounded-lg p-6 text-center transition-colors"
			type="button"
			disabled={isProcessing || !onClick}
			onClick={(event) => handleClick({ event })}
		>
			{isProcessing ? (
				<>
					<div className="flex flex-col items-center gap-3">
						<div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
						<p className="text-sm font-medium">Processando arquivos...</p>
						<p className="text-xs text-muted-foreground">
							{progress}% concluído
						</p>
					</div>
					<div className="w-full max-w-[180px]">
						<div className="bg-muted/50 h-1.5 w-full rounded-full overflow-hidden">
							<div
								className="bg-primary h-1.5 rounded-full transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="flex flex-col items-center gap-3">
						<div className="size-14 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center">
							<HugeiconsIcon
								icon={CloudUploadIcon}
								className="text-primary size-7"
							/>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-semibold">Importar Mídia</p>
							<p className="text-xs text-muted-foreground">
								Clique aqui ou arraste seus arquivos
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3 text-muted-foreground">
						<div className="flex items-center gap-1.5 text-xs">
							<HugeiconsIcon icon={Video01Icon} className="size-3.5" />
							<span>Vídeo</span>
						</div>
						<div className="w-px h-3 bg-border" />
						<div className="flex items-center gap-1.5 text-xs">
							<HugeiconsIcon icon={Image01Icon} className="size-3.5" />
							<span>Imagem</span>
						</div>
						<div className="w-px h-3 bg-border" />
						<div className="flex items-center gap-1.5 text-xs">
							<HugeiconsIcon icon={MusicNote01Icon} className="size-3.5" />
							<span>Áudio</span>
						</div>
					</div>

					<p className="text-[10px] text-muted-foreground/60">
						MP4, MOV, AVI, PNG, JPG, MP3, WAV e mais
					</p>
				</>
			)}
		</button>
	);
}
