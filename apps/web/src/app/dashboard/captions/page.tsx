"use client";
import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Sparkles,
	Copy,
	Check,
	Loader2,
	History,
	Linkedin,
	Instagram,
	Youtube,
	Twitter,
} from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
	{ id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-600" },
	{
		id: "instagram",
		label: "Instagram",
		icon: Instagram,
		color: "text-pink-500",
	},
	{ id: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500" },
	{
		id: "tiktok",
		label: "TikTok",
		icon: () => <span className="text-sm font-bold">TK</span>,
		color: "text-foreground",
	},
	{ id: "twitter", label: "Twitter / X", icon: Twitter, color: "text-sky-500" },
];

interface GeneratedCaption {
	id: string;
	clipTitle: string;
	platform: string;
	caption: string;
	score?: number;
	createdAt: string;
}

interface CaptionPrefillPayload {
	platform?: string;
	clipTitle?: string;
	clipCaption?: string;
	transcript?: string;
	score?: number;
	source?: string;
	createdAt?: string;
}

const CAPTION_PREFILL_STORAGE_KEY = "opencut:captions-prefill";

function formatDateTimeBrUtc(input: string) {
	const date = new Date(input);
	if (Number.isNaN(date.getTime())) return "";
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const year = date.getUTCFullYear();
	const hour = String(date.getUTCHours()).padStart(2, "0");
	const minute = String(date.getUTCMinutes()).padStart(2, "0");
	return `${day}/${month}/${year} ${hour}:${minute}`;
}

export default function CaptionsPage() {
	const [platform, setPlatform] = useState("instagram");
	const [clipTitle, setClipTitle] = useState("");
	const [transcript, setTranscript] = useState("");
	const [clipCaption, setClipCaption] = useState("");
	const [score, setScore] = useState("");
	const [loading, setLoading] = useState(false);
	const [generatedText, setGeneratedText] = useState("");
	const [copied, setCopied] = useState(false);
	const [history, setHistory] = useState<GeneratedCaption[]>([]);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [prefilledFromStudio, setPrefilledFromStudio] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const rawPayload = window.sessionStorage.getItem(
			CAPTION_PREFILL_STORAGE_KEY,
		);
		if (!rawPayload) return;

		try {
			const payload = JSON.parse(rawPayload) as CaptionPrefillPayload;
			if (
				payload.platform &&
				PLATFORMS.some((item) => item.id === payload.platform)
			) {
				setPlatform(payload.platform);
			}
			if (payload.clipTitle) setClipTitle(payload.clipTitle);
			if (payload.clipCaption) setClipCaption(payload.clipCaption);
			if (payload.transcript) setTranscript(payload.transcript);
			if (typeof payload.score === "number" && Number.isFinite(payload.score)) {
				setScore(String(Math.max(0, Math.min(100, Math.round(payload.score)))));
			}

			setPrefilledFromStudio(true);
			toast.success("Dados do clip preenchidos automaticamente do AI Studio.");
		} catch (error) {
			console.error("Falha ao carregar prefill de caption:", error);
		} finally {
			window.sessionStorage.removeItem(CAPTION_PREFILL_STORAGE_KEY);
		}
	}, []);

	useEffect(() => {
		fetch("/api/captions")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) {
					setHistory(
						data.sort(
							(a: GeneratedCaption, b: GeneratedCaption) =>
								new Date(b.createdAt).getTime() -
								new Date(a.createdAt).getTime(),
						),
					);
				}
			})
			.catch(() => {})
			.finally(() => setHistoryLoading(false));
	}, []);

	const handleGenerate = async () => {
		if (!clipTitle.trim()) {
			toast.error("Título do clip é obrigatório");
			return;
		}
		setLoading(true);
		setGeneratedText("");
		try {
			const res = await fetch("/api/captions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					platform,
					clipTitle: clipTitle.trim(),
					transcript: transcript.trim() || undefined,
					caption: clipCaption.trim() || undefined,
					score: score ? parseInt(score, 10) : undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Erro ao gerar");
			setGeneratedText(data.caption);
			// Refresh history
			const newItem: GeneratedCaption = {
				id: data.id,
				clipTitle: clipTitle.trim(),
				platform,
				caption: data.caption,
				score: score ? parseInt(score, 10) : undefined,
				createdAt: new Date().toISOString(),
			};
			setHistory((prev) => [newItem, ...prev]);
			toast.success("Caption gerada com sucesso!");
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Erro ao gerar caption";
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		toast.success("Copiado!");
		setTimeout(() => setCopied(false), 2000);
	};

	const platformLabel = (id: string) =>
		PLATFORMS.find((p) => p.id === id)?.label || id;

	return (
		<div className="space-y-8 max-w-4xl">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Sparkles className="w-7 h-7 text-primary" />
				<div>
					<h1 className="text-3xl font-bold">Gerador de Captions</h1>
					<p className="text-muted-foreground">
						IA gera captions otimizadas para cada plataforma
					</p>
					{prefilledFromStudio && (
						<Badge variant="outline" className="mt-2">
							Dados carregados do AI Studio
						</Badge>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Left — Input */}
				<div className="space-y-6">
					{/* Platform selector */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Plataforma</CardTitle>
							<CardDescription>Selecione onde será publicado</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
								{PLATFORMS.map((p) => {
									const Icon = p.icon;
									return (
										<button
											key={p.id}
											type="button"
											onClick={() => setPlatform(p.id)}
											className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs font-medium
                        ${
													platform === p.id
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-muted-foreground/50 text-muted-foreground"
												}`}
										>
											<span className={p.color}>
												<Icon className="w-5 h-5" />
											</span>
											{p.label}
										</button>
									);
								})}
							</div>
						</CardContent>
					</Card>

					{/* Clip info */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Informações do Clip</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>Título do clip *</Label>
								<Input
									placeholder="Ex: 3 erros que todo empreendedor comete"
									value={clipTitle}
									onChange={(e) => setClipTitle(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Score viral (opcional)</Label>
								<Input
									type="number"
									placeholder="0-100"
									min={0}
									max={100}
									value={score}
									onChange={(e) => setScore(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Caption original do clip (opcional)</Label>
								<Textarea
									placeholder="Caption identificada automaticamente pelo AI Studio..."
									value={clipCaption}
									onChange={(e) => setClipCaption(e.target.value)}
									rows={2}
								/>
							</div>
							<div className="space-y-2">
								<Label>Transcrição do trecho (opcional)</Label>
								<Textarea
									placeholder="Cole o texto falado no clip para captions mais precisas..."
									value={transcript}
									onChange={(e) => setTranscript(e.target.value)}
									rows={4}
								/>
							</div>
						</CardContent>
					</Card>

					<Button
						className="w-full gap-2"
						onClick={handleGenerate}
						disabled={loading}
						size="lg"
					>
						{loading ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Gerando caption...
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4" />
								Gerar Caption para {platformLabel(platform)}
							</>
						)}
					</Button>
				</div>

				{/* Right — Output */}
				<div className="space-y-6">
					{/* Generated caption */}
					<Card className="min-h-[300px]">
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Caption Gerada</CardTitle>
								{generatedText && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleCopy(generatedText)}
										className="gap-2"
									>
										{copied ? (
											<>
												<Check className="w-3 h-3" />
												Copiado!
											</>
										) : (
											<>
												<Copy className="w-3 h-3" />
												Copiar
											</>
										)}
									</Button>
								)}
							</div>
							{generatedText && (
								<Badge variant="secondary" className="w-fit">
									{platformLabel(platform)}
								</Badge>
							)}
						</CardHeader>
						<CardContent>
							{loading ? (
								<div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
									<Loader2 className="w-8 h-8 animate-spin" />
									<p className="text-sm">A IA está criando sua caption...</p>
								</div>
							) : generatedText ? (
								<div className="bg-muted/30 rounded-lg p-4">
									<pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
										{generatedText}
									</pre>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
									<Sparkles className="w-8 h-8 opacity-30" />
									<p className="text-sm">
										Preencha as informações e clique em Gerar
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Tips by platform */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								Dicas para {platformLabel(platform)}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<PlatformTips platform={platform} />
						</CardContent>
					</Card>
				</div>
			</div>

			{/* History */}
			<div>
				<div className="flex items-center gap-2 mb-4">
					<History className="w-5 h-5 text-muted-foreground" />
					<h2 className="text-lg font-semibold">Histórico de Captions</h2>
					<Badge variant="outline">{history.length}</Badge>
				</div>

				{historyLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
					</div>
				) : history.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<Sparkles className="w-8 h-8 opacity-30 mb-2" />
							<p className="text-sm">Nenhuma caption gerada ainda</p>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-3">
						{history.slice(0, 10).map((item) => (
							<Card key={item.id} className="group">
								<CardContent className="pt-4">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium text-sm truncate">
													{item.clipTitle}
												</span>
												<Badge variant="secondary" className="text-xs shrink-0">
													{platformLabel(item.platform)}
												</Badge>
												{item.score && (
													<Badge variant="outline" className="text-xs shrink-0">
														Score {item.score}
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2">
												{item.caption}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												{formatDateTimeBrUtc(item.createdAt)}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() => handleCopy(item.caption)}
										>
											<Copy className="w-4 h-4" />
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function PlatformTips({ platform }: { platform: string }) {
	const tips: Record<string, string[]> = {
		linkedin: [
			"Gancho forte na 1ª linha (aparece antes do 'ver mais')",
			"Tom profissional mas humano — evite jargão corporativo",
			"Termine com pergunta para engajar comentários",
			"3-5 hashtags profissionais no final",
		],
		instagram: [
			"1ª frase precisa parar o scroll — seja direto",
			"Use emojis para dar ritmo e quebrar o texto",
			"10-20 hashtags separadas do texto por quebras",
			"CTA claro: 'salve', 'compartilhe', 'comente'",
		],
		youtube: [
			"Título com palavra-chave principal (até 60 chars)",
			"1º parágrafo da descrição é crucial para SEO",
			"Adicione timestamps dos momentos principais",
			"Links e hashtags no final da descrição",
		],
		tiktok: [
			"Caption cortada após ~150 chars — seja direto",
			"Comece com gancho ou pergunta provocativa",
			"5-8 hashtags trending no nicho",
			"Emojis chamativos no início funcionam bem",
		],
		twitter: [
			"Máximo 280 caracteres — cada palavra conta",
			"Afirmações fortes geram mais retweets",
			"2-3 hashtags no máximo",
			"Termine com algo que instigue resposta",
		],
	};

	const list = tips[platform] || tips.instagram;

	return (
		<ul className="space-y-2">
			{list.map((tip) => (
				<li
					key={`${platform}-${tip}`}
					className="flex items-start gap-2 text-sm text-muted-foreground"
				>
					<span className="text-primary font-bold shrink-0">✓</span>
					{tip}
				</li>
			))}
		</ul>
	);
}
