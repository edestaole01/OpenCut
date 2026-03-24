import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

const steps = [
	{
		number: "1",
		title: "Importe sua mídia",
		description: 'Clique em "Mídia" na esquerda e use o botão Importar',
	},
	{
		number: "2",
		title: "Arraste para a timeline",
		description: "Arraste o arquivo para a faixa na parte inferior",
	},
	{
		number: "3",
		title: "Selecione para editar",
		description: "Clique em um elemento na timeline para editar aqui",
	},
];

export function EmptyView() {
	return (
		<div className="bg-background flex h-full flex-col items-center justify-center gap-5 p-5">
			<div className="flex flex-col gap-1 text-center">
				<p className="text-sm font-semibold">Como começar</p>
				<p className="text-muted-foreground text-xs">Siga os passos abaixo</p>
			</div>

			<div className="flex flex-col gap-3 w-full max-w-[180px]">
				{steps.map((step, i) => (
					<div key={step.number} className="flex flex-col items-center gap-1.5">
						<div className="flex items-center gap-2.5 w-full">
							<div className="size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
								<span className="text-[10px] font-bold text-primary">{step.number}</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-medium leading-tight">{step.title}</p>
								<p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{step.description}</p>
							</div>
						</div>
						{i < steps.length - 1 && (
							<HugeiconsIcon
								icon={ArrowDown01Icon}
								className="text-muted-foreground/40 size-3"
							/>
						)}
					</div>
				))}
			</div>

			<div className="border border-dashed rounded-lg p-3 w-full max-w-[180px] text-center bg-muted/20">
				<p className="text-[10px] text-muted-foreground leading-relaxed">
					💡 <strong>Dica:</strong> Use{" "}
					<kbd className="bg-muted px-1 rounded text-[9px]">Espaço</kbd> para play/pause
					e <kbd className="bg-muted px-1 rounded text-[9px]">S</kbd> para cortar
				</p>
			</div>
		</div>
	);
}
