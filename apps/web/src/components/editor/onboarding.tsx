"use client";

import { useState } from "react";
import { useLocalStorage } from "@/hooks/storage/use-local-storage";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

const STEPS = [
	{
		emoji: "🎬",
		title: "Bem-vindo ao Editor de Vídeo!",
		description: "Este editor tem 4 áreas principais. Vamos conhecê-las rapidamente.",
		content: (
			<div className="grid grid-cols-2 gap-2 mt-3">
				{[
					{ area: "① Esquerda", desc: "Abas de mídia, texto, efeitos e configurações", color: "bg-blue-500/10 border-blue-500/30 text-blue-600" },
					{ area: "② Centro", desc: "Prévia do vídeo — veja o resultado em tempo real", color: "bg-green-500/10 border-green-500/30 text-green-600" },
					{ area: "③ Direita", desc: "Propriedades do elemento selecionado (posição, cor...)", color: "bg-orange-500/10 border-orange-500/30 text-orange-600" },
					{ area: "④ Baixo", desc: "Timeline — organize e edite seus clips aqui", color: "bg-purple-500/10 border-purple-500/30 text-purple-600" },
				].map(item => (
					<div key={item.area} className={`rounded-lg border p-2.5 ${item.color}`}>
						<p className="text-xs font-bold">{item.area}</p>
						<p className="text-xs mt-0.5 opacity-80">{item.desc}</p>
					</div>
				))}
			</div>
		),
	},
	{
		emoji: "📁",
		title: "Passo 1: Importe sua mídia",
		description: "Clique na aba \"Mídia\" (ícone de pasta) no painel esquerdo, depois clique em Importar ou arraste seus arquivos.",
		content: (
			<div className="mt-3 rounded-lg bg-muted/50 p-3 space-y-2">
				<p className="text-xs font-medium">Formatos suportados:</p>
				<div className="flex flex-wrap gap-1.5">
					{["MP4", "MOV", "AVI", "MKV", "PNG", "JPG", "MP3", "WAV"].map(f => (
						<span key={f} className="text-[10px] bg-background border rounded px-1.5 py-0.5 font-mono">{f}</span>
					))}
				</div>
				<p className="text-xs text-muted-foreground mt-2">
					💡 Após importar, <strong>arraste o arquivo</strong> para a timeline na parte inferior da tela.
				</p>
			</div>
		),
	},
	{
		emoji: "✂️",
		title: "Passo 2: Edite na timeline",
		description: "A timeline é onde você organiza e corta os clips. Use as ferramentas no topo da timeline:",
		content: (
			<div className="mt-3 space-y-2">
				{[
					{ key: "S", desc: "Cortar o clip na posição atual do cursor" },
					{ key: "Q", desc: "Remover a parte esquerda do corte" },
					{ key: "W", desc: "Remover a parte direita do corte" },
					{ key: "Del", desc: "Deletar o elemento selecionado" },
					{ key: "Espaço", desc: "Play / Pause" },
					{ key: "Ctrl+Z", desc: "Desfazer a última ação" },
				].map(item => (
					<div key={item.key} className="flex items-center gap-2.5">
						<kbd className="bg-muted border rounded px-2 py-0.5 text-[10px] font-mono shrink-0 min-w-[40px] text-center">{item.key}</kbd>
						<span className="text-xs text-muted-foreground">{item.desc}</span>
					</div>
				))}
			</div>
		),
	},
	{
		emoji: "🚀",
		title: "Passo 3: Exporte seu vídeo",
		description: "Quando terminar, clique no botão azul Export no canto superior direito.",
		content: (
			<div className="mt-3 space-y-3">
				<div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
					<p className="text-xs font-medium">Opções de exportação:</p>
					{[
						{ label: "Formato", value: "MP4 (H.264) ou WebM" },
						{ label: "Qualidade", value: "Alta, Média ou Baixa" },
						{ label: "Resolução", value: "Definida nas configurações do projeto" },
					].map(item => (
						<div key={item.label} className="flex justify-between text-xs">
							<span className="text-muted-foreground">{item.label}</span>
							<span className="font-medium">{item.value}</span>
						</div>
					))}
				</div>
				<p className="text-xs text-muted-foreground">
					🎉 Pronto! Você já sabe o essencial para editar vídeos aqui.
				</p>
			</div>
		),
	},
];

export function Onboarding() {
	const [step, setStep] = useState(0);
	const [hasSeenOnboarding, setHasSeenOnboarding] = useLocalStorage({
		key: "hasSeenOnboarding",
		defaultValue: false,
	});

	const isOpen = !hasSeenOnboarding;
	const isLast = step === STEPS.length - 1;
	const currentStep = STEPS[step];

	const handleNext = () => {
		if (isLast) {
			setHasSeenOnboarding({ value: true });
		} else {
			setStep(step + 1);
		}
	};

	const handleSkip = () => {
		setHasSeenOnboarding({ value: true });
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleSkip}>
			<DialogContent className="sm:max-w-[460px]">
				<DialogTitle>
					<span className="sr-only">{currentStep.title}</span>
				</DialogTitle>
				<DialogDescription className="sr-only">
					{currentStep.description}
				</DialogDescription>
				<DialogBody>
					<div className="space-y-4">
						{/* Step indicators */}
						<div className="flex items-center gap-1.5">
							{STEPS.map((stepItem, i) => (
								<div
									key={stepItem.title}
									className={`h-1 rounded-full transition-all duration-300 ${
										i === step ? "bg-primary flex-1" : i < step ? "bg-primary/40 w-4" : "bg-muted w-4"
									}`}
								/>
							))}
						</div>

						{/* Content */}
						<div>
							<div className="flex items-start gap-3">
								<span className="text-2xl">{currentStep.emoji}</span>
								<div>
									<h2 className="text-base font-bold">{currentStep.title}</h2>
									<p className="text-sm text-muted-foreground mt-1">{currentStep.description}</p>
								</div>
							</div>
							{currentStep.content}
						</div>

						{/* Actions */}
						<div className="flex items-center justify-between pt-1">
							<button
								type="button"
								onClick={handleSkip}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								Pular tutorial
							</button>
							<Button onClick={handleNext} size="sm" className="gap-2">
								{isLast ? (
									<><CheckIcon className="size-3.5" />Começar a editar</>
								) : (
									<>Próximo<ArrowRightIcon className="size-3.5" /></>
								)}
							</Button>
						</div>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
