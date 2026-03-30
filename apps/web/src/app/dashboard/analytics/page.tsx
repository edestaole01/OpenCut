"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	BarChart2,
	Eye,
	FileText,
	Gauge,
	Loader2,
	RefreshCw,
	Sparkles,
	TrendingUp,
	Zap,
	Clock,
	Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SocialPostStatus = "draft" | "scheduled" | "published";

interface SocialPost {
	id: string;
	platform: string;
	title: string;
	caption: string;
	scheduledFor: string;
	status: SocialPostStatus;
	createdAt: string;
}

interface AnalyticsResponse {
	summary: {
		videosAnalyzed: number;
		clipsGenerated: number;
		captionsGenerated: number;
		avgViralScore: number;
		avgCaptionScore: number;
		estimatedViews: number;
		estimatedHoursSaved: number;
		transcriptCoverage: number;
		mockAnalyses: number;
	};
	topTags: Array<{ tag: string; count: number }>;
	topClips: Array<{
		videoName: string;
		title: string;
		tag: string;
		score: number;
		duration: number;
	}>;
	trend: Array<{
		date: string;
		videos: number;
		clips: number;
		captions: number;
	}>;
	captionsByPlatform: Array<{ platform: string; count: number }>;
	usage: {
		totalCalls: number;
		tokensUsedTotal: number;
		costUsdTotal: number;
		byFeature: Array<{ feature: string; count: number }>;
		byProvider: Array<{ provider: string; count: number }>;
	};
}

interface SocialSummary {
	total: number;
	draft: number;
	scheduled: number;
	published: number;
}

const SOCIAL_POSTS_STORAGE_KEY = "opencut:social:posts:v1";

function formatNumber(value: number) {
	return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDecimal(value: number, digits = 1) {
	return new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);
}

function formatCompactDate(dateIso: string) {
	const date = new Date(dateIso);
	if (Number.isNaN(date.getTime())) return "--";
	return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function calculateSocialSummary(posts: SocialPost[]): SocialSummary {
	return posts.reduce(
		(acc, post) => {
			acc.total += 1;
			if (post.status === "draft") acc.draft += 1;
			if (post.status === "scheduled") acc.scheduled += 1;
			if (post.status === "published") acc.published += 1;
			return acc;
		},
		{ total: 0, draft: 0, scheduled: 0, published: 0 },
	);
}

export default function AnalyticsPage() {
	const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
	const [socialSummary, setSocialSummary] = useState<SocialSummary>({
		total: 0,
		draft: 0,
		scheduled: 0,
		published: 0,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadAnalytics = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/analytics", { cache: "no-store" });
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || "Falha ao carregar analytics");
			}
			setAnalytics(data as AnalyticsResponse);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao carregar analytics";
			setError(message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadAnalytics();
	}, [loadAnalytics]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = window.localStorage.getItem(SOCIAL_POSTS_STORAGE_KEY);
			if (!raw) return;
			const posts = JSON.parse(raw) as SocialPost[];
			if (!Array.isArray(posts)) return;
			setSocialSummary(calculateSocialSummary(posts));
		} catch {
			// ignore
		}
	}, []);

	const maxTrend = useMemo(() => {
		if (!analytics?.trend?.length) return 1;
		return Math.max(
			1,
			...analytics.trend.map((day) =>
				Math.max(day.videos, day.clips, day.captions),
			),
		);
	}, [analytics?.trend]);

	const cards = useMemo(() => {
		if (!analytics) return [];
		return [
			{
				label: "Videos analisados",
				value: formatNumber(analytics.summary.videosAnalyzed),
				icon: FileText,
				color: "text-blue-600",
				bg: "bg-blue-500/10",
			},
			{
				label: "Clips gerados",
				value: formatNumber(analytics.summary.clipsGenerated),
				icon: Zap,
				color: "text-amber-600",
				bg: "bg-amber-500/10",
			},
			{
				label: "Captions IA",
				value: formatNumber(analytics.summary.captionsGenerated),
				icon: Sparkles,
				color: "text-fuchsia-600",
				bg: "bg-fuchsia-500/10",
			},
			{
				label: "Score viral medio",
				value: analytics.summary.avgViralScore
					? formatDecimal(analytics.summary.avgViralScore)
					: "0.0",
				icon: Gauge,
				color: "text-emerald-600",
				bg: "bg-emerald-500/10",
			},
			{
				label: "Visualizacoes estimadas",
				value: formatNumber(analytics.summary.estimatedViews),
				icon: Eye,
				color: "text-cyan-600",
				bg: "bg-cyan-500/10",
			},
			{
				label: "Tempo economizado",
				value: `${formatDecimal(analytics.summary.estimatedHoursSaved)}h`,
				icon: Clock,
				color: "text-violet-600",
				bg: "bg-violet-500/10",
			},
		];
	}, [analytics]);

	if (loading) {
		return (
			<div className="space-y-4">
				<div>
					<h1 className="text-3xl font-bold">Analytics</h1>
					<p className="text-muted-foreground mt-1">Carregando dados...</p>
				</div>
				<Card>
					<CardContent className="py-16 flex items-center justify-center gap-3 text-muted-foreground">
						<Loader2 className="w-5 h-5 animate-spin" />
						Processando metricas
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error || !analytics) {
		return (
			<div className="space-y-4">
				<div>
					<h1 className="text-3xl font-bold">Analytics</h1>
					<p className="text-muted-foreground mt-1">
						Performance e insights dos seus conteudos
					</p>
				</div>
				<Card>
					<CardContent className="py-12 text-center space-y-3">
						<p className="text-sm text-red-600">
							{error || "Nao foi possivel carregar os analytics."}
						</p>
						<div className="flex gap-2 justify-center">
							<Button variant="outline" onClick={loadAnalytics}>
								<RefreshCw className="w-4 h-4 mr-2" />
								Tentar novamente
							</Button>
							<Link href="/dashboard/ai-studio">
								<Button>
									<Zap className="w-4 h-4 mr-2" />
									Ir para AI Studio
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6 pb-14">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold">Analytics</h1>
					<p className="text-muted-foreground mt-1">
						Performance e insights dos seus conteudos
					</p>
				</div>
				<Button variant="outline" onClick={loadAnalytics}>
					<RefreshCw className="w-4 h-4 mr-2" />
					Atualizar
				</Button>
			</div>

			<div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
				{cards.map((card) => (
					<Card key={card.label}>
						<CardContent className="p-4">
							<div
								className={cn(
									"w-9 h-9 rounded-lg flex items-center justify-center mb-2",
									card.bg,
								)}
							>
								<card.icon className={cn("w-4 h-4", card.color)} />
							</div>
							<p className="text-xl font-bold leading-none">{card.value}</p>
							<p className="text-[11px] text-muted-foreground mt-1">
								{card.label}
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<BarChart2 className="w-5 h-5 text-primary" />
							Tendencia dos ultimos 14 dias
						</CardTitle>
						<CardDescription>
							Videos, clips e captions gerados por dia.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{analytics.trend.map((day) => (
								<div
									key={day.date}
									className="grid grid-cols-[52px_1fr] items-center gap-3"
								>
									<span className="text-xs text-muted-foreground">
										{formatCompactDate(day.date)}
									</span>
									<div className="space-y-1.5">
										<div className="h-2 bg-blue-500/15 rounded-full overflow-hidden">
											<div
												className="h-full bg-blue-500"
												style={{ width: `${(day.videos / maxTrend) * 100}%` }}
											/>
										</div>
										<div className="h-2 bg-amber-500/15 rounded-full overflow-hidden">
											<div
												className="h-full bg-amber-500"
												style={{ width: `${(day.clips / maxTrend) * 100}%` }}
											/>
										</div>
										<div className="h-2 bg-fuchsia-500/15 rounded-full overflow-hidden">
											<div
												className="h-full bg-fuchsia-500"
												style={{ width: `${(day.captions / maxTrend) * 100}%` }}
											/>
										</div>
									</div>
								</div>
							))}
						</div>
						<div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-blue-500" />
								Videos
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-amber-500" />
								Clips
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-fuchsia-500" />
								Captions
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<TrendingUp className="w-5 h-5 text-primary" />
							Qualidade das analises
						</CardTitle>
						<CardDescription>
							Saude das transcricoes e confiabilidade.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="text-xs text-muted-foreground">
								Cobertura de transcricao real
							</p>
							<p className="text-2xl font-bold">
								{formatDecimal(analytics.summary.transcriptCoverage)}%
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">
								Analises em modo demo
							</p>
							<p className="text-2xl font-bold">
								{formatNumber(analytics.summary.mockAnalyses)}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">
								Score medio de captions
							</p>
							<p className="text-2xl font-bold">
								{analytics.summary.avgCaptionScore
									? formatDecimal(analytics.summary.avgCaptionScore)
									: "0.0"}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Top clips por score</CardTitle>
						<CardDescription>
							Trechos com maior potencial viral identificado.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{analytics.topClips.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhum clip analisado ainda.
							</p>
						) : (
							<div className="space-y-3">
								{analytics.topClips.map((clip) => (
									<div
										key={`${clip.videoName}-${clip.title}`}
										className="rounded-lg border p-3"
									>
										<div className="flex items-center justify-between gap-2">
											<p className="font-medium text-sm truncate">
												{clip.title}
											</p>
											<Badge>{formatDecimal(clip.score)}</Badge>
										</div>
										<p className="text-xs text-muted-foreground truncate mt-1">
											{clip.videoName}
										</p>
										<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
											<Badge variant="outline">{clip.tag}</Badge>
											<span>{formatDecimal(clip.duration)}s</span>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Distribuicao de captions
						</CardTitle>
						<CardDescription>
							Plataformas com mais captions geradas.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{analytics.captionsByPlatform.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhuma caption gerada ainda.
							</p>
						) : (
							<div className="space-y-3">
								{analytics.captionsByPlatform.map((row) => {
									const percent = analytics.summary.captionsGenerated
										? (row.count / analytics.summary.captionsGenerated) * 100
										: 0;
									return (
										<div key={row.platform} className="space-y-1">
											<div className="flex items-center justify-between text-sm">
												<span className="font-medium capitalize">
													{row.platform}
												</span>
												<span className="text-muted-foreground">
													{row.count}
												</span>
											</div>
											<div className="h-2 bg-muted rounded-full overflow-hidden">
												<div
													className="h-full bg-primary"
													style={{ width: `${percent}%` }}
												/>
											</div>
										</div>
									);
								})}
							</div>
						)}

						<div className="mt-5">
							<p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
								Tags mais usadas
							</p>
							<div className="flex flex-wrap gap-2">
								{analytics.topTags.length === 0 ? (
									<span className="text-xs text-muted-foreground">
										Sem tags ainda.
									</span>
								) : (
									analytics.topTags.map((tag) => (
										<Badge key={tag.tag} variant="outline" className="text-xs">
											{tag.tag} ({tag.count})
										</Badge>
									))
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Share2 className="w-5 h-5 text-primary" />
							Publicacoes sociais
						</CardTitle>
						<CardDescription>
							Status da fila de posts em Redes Sociais.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3">
						<MetricChip label="Total" value={socialSummary.total} />
						<MetricChip label="Rascunho" value={socialSummary.draft} />
						<MetricChip label="Agendado" value={socialSummary.scheduled} />
						<MetricChip label="Publicado" value={socialSummary.published} />
						<div className="col-span-2 pt-2">
							<Link href="/dashboard/redes-sociais">
								<Button variant="outline" className="w-full">
									Abrir painel de Redes Sociais
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Uso de IA</CardTitle>
						<CardDescription>
							Chamadas e consumo registrados por recurso.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-3 gap-3">
							<MiniStat label="Chamadas" value={analytics.usage.totalCalls} />
							<MiniStat
								label="Tokens"
								value={analytics.usage.tokensUsedTotal}
							/>
							<MiniStat
								label="Custo (USD)"
								value={analytics.usage.costUsdTotal}
								formatter={(v) => `$${formatDecimal(v, 4)}`}
							/>
						</div>

						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
								Por funcionalidade
							</p>
							<div className="flex flex-wrap gap-2">
								{analytics.usage.byFeature.length === 0 ? (
									<span className="text-xs text-muted-foreground">
										Sem uso registrado.
									</span>
								) : (
									analytics.usage.byFeature.map((row) => (
										<Badge key={row.feature} variant="outline">
											{row.feature}: {row.count}
										</Badge>
									))
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function MetricChip({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-xl font-semibold mt-1">{formatNumber(value)}</p>
		</div>
	);
}

function MiniStat({
	label,
	value,
	formatter,
}: {
	label: string;
	value: number;
	formatter?: (value: number) => string;
}) {
	return (
		<div className="rounded-lg border p-3">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="text-sm font-semibold mt-1">
				{formatter ? formatter(value) : formatNumber(value)}
			</p>
		</div>
	);
}
