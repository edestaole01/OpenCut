"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import NextImage from "next/image";
import { fetchWithCache, invalidateCache } from "./utils/history-cache";
import { UploadStep } from "./components/upload-step";
import { AnalysisStep } from "./components/analysis-step";
import { ClipsStep } from "./components/clips-step";
import { cn } from "@/lib/utils";
import {
	Upload,
	Brain,
	Scissors,
	Share2,
	ArrowRight,
	Calendar,
	Clock,
	Film,
	Plus,
	Pencil,
	Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type AnalysisResult = Record<string, unknown>;

interface HistoryItem {
	id: string;
	videoName: string;
	videoSize: number;
	result: AnalysisResult;
	createdAt: string;
}

const steps = [
	{ id: 1, label: "Upload", icon: Upload },
	{ id: 2, label: "Análise", icon: Brain },
	{ id: 3, label: "Clips", icon: Scissors },
	{ id: 4, label: "Publicar", icon: Share2 },
];

export default function AIStudioPage() {
	const [currentStep, setCurrentStep] = useState(1);
	const [videoFile, setVideoFile] = useState<File | null>(null);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null,
	);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [updatingHistoryId, setUpdatingHistoryId] = useState<string | null>(
		null,
	);
	const [, setPendingHistoryItem] = useState<HistoryItem | null>(null);
	const reuploadRef = useRef<HTMLInputElement>(null);

	const fetchHistory = useCallback((forceRefresh = false) => {
		if (forceRefresh) invalidateCache("/api/ai-studio/history");
		setHistoryLoading(true);
		fetchWithCache<HistoryItem[]>("/api/ai-studio/history")
			.then((data) => {
				if (Array.isArray(data)) setHistory(data);
			})
			.catch(() => {})
			.finally(() => setHistoryLoading(false));
	}, []);

	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	const handleHistorySelect = (item: HistoryItem) => {
		// Limpa URL anterior se existir
		if (videoUrl?.startsWith("blob:")) {
			URL.revokeObjectURL(videoUrl);
		}

		setAnalysisResult(item.result);
		setVideoFile(null);

		const sourceUrl = item.result?.sourceVideoUrl ?? null;
		setVideoUrl(sourceUrl);
		setCurrentStep(3);
	};

	const handleReuploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Se havia uma URL de blob anterior, revoga
		if (videoUrl?.startsWith("blob:")) {
			URL.revokeObjectURL(videoUrl);
		}

		const newUrl = URL.createObjectURL(file);
		setVideoFile(file);
		setVideoUrl(newUrl);

		// Atualiza o resultado da análise para incluir a nova URL (opcional, mas ajuda na consistência)
		if (analysisResult) {
			setAnalysisResult({
				...analysisResult,
				sourceVideoUrl: newUrl,
			});
		}

		setPendingHistoryItem(null);
		toast.success("Vídeo reconectado com sucesso!");
		e.target.value = "";
	};

	const handleVideoSelected = (file: File) => {
		setVideoFile(file);
		setVideoUrl(URL.createObjectURL(file));
		setCurrentStep(2);
	};

	const handleRenameHistoryItem = async (item: HistoryItem) => {
		const nextName = window
			.prompt("Novo nome do vídeo", item.videoName)
			?.trim();
		if (!nextName || nextName === item.videoName) return;

		setUpdatingHistoryId(item.id);
		try {
			const response = await fetch(
				`/api/ai-studio/history?id=${encodeURIComponent(item.id)}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ videoName: nextName }),
				},
			);

			if (!response.ok) {
				throw new Error("Falha ao renomear");
			}

			setHistory((prev) =>
				prev.map((historyItem) =>
					historyItem.id === item.id
						? { ...historyItem, videoName: nextName }
						: historyItem,
				),
			);
			toast.success("Nome atualizado com sucesso.");
		} catch {
			toast.error("Não foi possível atualizar o nome.");
		} finally {
			setUpdatingHistoryId(null);
		}
	};

	const handleDeleteHistoryItem = async (item: HistoryItem) => {
		const confirmed = window.confirm(
			`Tem certeza que deseja excluir "${item.videoName}" do histórico?`,
		);
		if (!confirmed) return;

		setUpdatingHistoryId(item.id);
		try {
			const response = await fetch(
				`/api/ai-studio/history?id=${encodeURIComponent(item.id)}`,
				{
					method: "DELETE",
				},
			);

			if (!response.ok) {
				throw new Error("Falha ao excluir");
			}

			setHistory((prev) =>
				prev.filter((historyItem) => historyItem.id !== item.id),
			);
			toast.success("Item excluído do histórico.");
		} catch {
			toast.error("Não foi possível excluir este item.");
		} finally {
			setUpdatingHistoryId(null);
		}
	};

	return (
		<div className="space-y-8 pb-20">
			<input
				ref={reuploadRef}
				type="file"
				accept="video/mp4,video/mov,video/avi,video/mkv,video/*"
				className="hidden"
				onChange={handleReuploadFile}
			/>

			<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">AI Studio</h1>
					<p className="text-muted-foreground mt-1">
						Gere clips e captions automaticamente com inteligência artificial
					</p>
				</div>

				{currentStep > 1 && (
					<Button
						variant="outline"
						size="sm"
						className="gap-2 h-9"
						onClick={() => {
							setCurrentStep(1);
							setVideoFile(null);
							setVideoUrl(null);
							setAnalysisResult(null);
						}}
					>
						<Plus className="w-4 h-4" />
						Novo vídeo
					</Button>
				)}
			</div>

			<div className="flex items-center gap-0">
				{steps.map((step, index) => (
					<div key={step.id} className="flex items-center flex-1">
						<div className="flex flex-col items-center gap-1">
							<div
								className={cn(
									"w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
									currentStep === step.id
										? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30"
										: currentStep > step.id
											? "bg-primary/15 border-primary/40 text-primary"
											: "bg-muted border-muted-foreground/20 text-muted-foreground",
								)}
							>
								<step.icon className="w-4 h-4" />
							</div>
							<span
								className={cn(
									"text-[11px] font-medium",
									currentStep >= step.id
										? "text-primary"
										: "text-muted-foreground",
								)}
							>
								{step.label}
							</span>
						</div>
						{index < steps.length - 1 && (
							<div
								className={cn(
									"flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors",
									currentStep > step.id ? "bg-primary/40" : "bg-muted",
								)}
							/>
						)}
					</div>
				))}
			</div>

			{currentStep === 1 && (
				<div className="space-y-12 animate-in fade-in duration-500">
					<div className="max-w-4xl mx-auto">
						<UploadStep onVideoSelected={handleVideoSelected} />
					</div>

					<div className="space-y-6 max-w-6xl mx-auto">
						<div className="flex items-center justify-between px-2">
							<div className="space-y-1">
								<h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
									<Clock className="w-5 h-5 text-primary" />
									Sua Biblioteca de IA
								</h2>
								<p className="text-sm text-muted-foreground text-pretty">
									Recupere clips e transcrições de vídeos analisados
									anteriormente.
								</p>
							</div>

							{!historyLoading && history.length > 0 && (
								<div className="flex items-center gap-3">
									<Badge
										variant="outline"
										className="font-mono text-[11px] h-6"
									>
										{history.length} Vídeo{history.length !== 1 ? "s" : ""}
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 text-xs gap-1.5"
										onClick={() => fetchHistory(true)}
									>
										<Plus className="w-3.5 h-3.5 rotate-45" /> Atualizar
									</Button>
								</div>
							)}
						</div>

						{historyLoading ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
								{[1, 2, 3, 4].map((i) => (
									<div
										key={i}
										className="h-40 rounded-2xl bg-muted animate-pulse border border-border/50"
									/>
								))}
							</div>
						) : history.length === 0 ? (
							<div className="bg-muted/30 border-2 border-dashed rounded-3xl p-16 text-center space-y-4 max-w-2xl mx-auto">
								<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
									<Film className="w-8 h-8 opacity-20" />
								</div>
								<div className="space-y-1">
									<p className="font-semibold text-lg text-foreground/70">
										Nenhuma análise encontrada
									</p>
									<p className="text-sm text-muted-foreground">
										Faça o upload do seu primeiro vídeo para ver a mágica da IA
										acontecer.
									</p>
								</div>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
								{history.map((item, idx) => {
									const clipsCount = item.result?.clips?.length ?? 0;
									const thumb = item.result?.thumbnail;
									return (
										<Card
											key={item.id}
											className={cn(
												"group hover:border-primary/50 transition-all cursor-pointer overflow-hidden border-border/60 hover:shadow-xl hover:-translate-y-1",
												idx === 0
													? "border-primary/20 bg-primary/5 shadow-sm"
													: "",
											)}
											onClick={() => handleHistorySelect(item)}
										>
											<CardContent className="p-0">
												<div
													className={cn(
														"aspect-video w-full relative flex items-center justify-center transition-colors",
														idx === 0
															? "bg-primary/10"
															: "bg-muted group-hover:bg-primary/5",
													)}
												>
													<div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
														<Button
															type="button"
															variant="secondary"
															size="icon"
															className="h-6 w-6 bg-background/90 hover:bg-background"
															disabled={updatingHistoryId === item.id}
															onClick={(event) => {
																event.stopPropagation();
																handleRenameHistoryItem(item);
															}}
															title="Editar nome"
														>
															<Pencil className="w-3.5 h-3.5" />
														</Button>
														<Button
															type="button"
															variant="destructive"
															size="icon"
															className="h-6 w-6"
															disabled={updatingHistoryId === item.id}
															onClick={(event) => {
																event.stopPropagation();
																handleDeleteHistoryItem(item);
															}}
															title="Excluir"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</Button>
													</div>

													{thumb ? (
														<NextImage
															src={thumb}
															alt={item.videoName}
															fill
															sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
															className="object-cover transition-transform group-hover:scale-105"
														/>
													) : (
														<Film
															className={cn(
																"w-10 h-10 transition-transform group-hover:scale-110",
																idx === 0
																	? "text-primary"
																	: "text-muted-foreground/40 group-hover:text-primary/40",
															)}
														/>
													)}

													{idx === 0 && (
														<div className="absolute top-2 right-2 z-10">
															<Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground border-none shadow-sm">
																Recente
															</Badge>
														</div>
													)}

													<div className="absolute bottom-2 left-2 flex items-center gap-1.5">
														<Badge
															variant="outline"
															className="bg-background/80 backdrop-blur-sm h-5 px-1.5 text-[9px] font-bold border-none"
														>
															{clipsCount} CLIPS
														</Badge>
													</div>
												</div>
												<div className="p-4 space-y-3">
													<p className="text-sm font-bold truncate leading-tight group-hover:text-primary transition-colors">
														{item.videoName}
													</p>
													<div className="flex items-center justify-between">
														<span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
															<Calendar className="w-3 h-3" />
															{new Date(item.createdAt).toLocaleDateString(
																"pt-BR",
															)}
														</span>
														<div className="flex items-center gap-1 text-primary">
															<ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</div>
				</div>
			)}

			{currentStep === 2 && videoFile && (
				<AnalysisStep
					videoFile={videoFile}
					onAnalysisComplete={(result) => {
						setAnalysisResult(result);
						setCurrentStep(3);
						fetchHistory(true);
					}}
					onBack={() => setCurrentStep(1)}
				/>
			)}

			{currentStep === 3 && analysisResult && (
				<ClipsStep
					key={videoUrl ?? ""}
					clips={analysisResult.clips}
					videoFile={videoFile}
					videoUrl={videoUrl ?? undefined}
					transcript={analysisResult.transcript}
					transcriptSource={analysisResult.transcriptSource}
					language={analysisResult.language}
					initialWords={analysisResult.words}
					isMock={Boolean(analysisResult.isMock)}
					onBack={() => setCurrentStep(videoFile ? 2 : 1)}
					onPublish={() => setCurrentStep(4)}
					onRequestVideoReupload={
						!videoFile && !videoUrl
							? (clip) => {
									setPendingHistoryItem({
										id: "",
										videoName: clip?.title ?? "video",
										videoSize: 0,
										result: analysisResult,
										createdAt: "",
									});
									reuploadRef.current?.click();
								}
							: undefined
					}
				/>
			)}

			{currentStep === 4 && (
				<div className="max-w-2xl mx-auto text-center space-y-4 py-12 animate-in zoom-in-95 duration-500">
					<div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
						<Share2 className="w-8 h-8 text-green-600" />
					</div>
					<h2 className="text-2xl font-bold">Pronto para publicar!</h2>
					<p className="text-muted-foreground text-sm">
						Integração com redes sociais em desenvolvimento. Em breve você
						poderá publicar diretamente no Instagram, LinkedIn, TikTok e
						YouTube.
					</p>
					<div className="flex gap-3 justify-center pt-4">
						<Button variant="outline" onClick={() => setCurrentStep(3)}>
							← Voltar aos clips
						</Button>
						<Button
							onClick={() => {
								setCurrentStep(1);
								setVideoFile(null);
								setVideoUrl(null);
								setAnalysisResult(null);
								fetchHistory();
							}}
						>
							<Plus className="w-4 h-4 mr-2" />
							Analisar novo vídeo
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
