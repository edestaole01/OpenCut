"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	Calendar,
	CheckCircle2,
	Clock3,
	Copy,
	Instagram,
	Linkedin,
	Plus,
	Share2,
	Sparkles,
	Trash2,
	Twitter,
	Unplug,
	Youtube,
	Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SocialPlatformId =
	| "linkedin"
	| "instagram"
	| "youtube"
	| "tiktok"
	| "twitter";
type PostStatus = "draft" | "scheduled" | "published";

interface SocialPlatformConfig {
	id: SocialPlatformId;
	name: string;
	icon: LucideIcon;
	color: string;
	bg: string;
}

interface SocialConnection {
	platform: SocialPlatformId;
	connected: boolean;
	handle?: string;
	updatedAt: string;
}

interface SocialPost {
	id: string;
	platform: SocialPlatformId;
	title: string;
	caption: string;
	scheduledFor: string;
	status: PostStatus;
	createdAt: string;
}

interface CaptionHistoryItem {
	id: string;
	clipTitle: string;
	platform: string;
	caption: string;
	score?: number;
	createdAt: string;
}

const STORAGE_CONNECTIONS = "opencut:social:connections:v1";
const STORAGE_POSTS = "opencut:social:posts:v1";

const PLATFORM_CONFIGS: SocialPlatformConfig[] = [
	{
		id: "linkedin",
		name: "LinkedIn",
		icon: Linkedin,
		color: "text-blue-600",
		bg: "bg-blue-50 dark:bg-blue-900/20",
	},
	{
		id: "instagram",
		name: "Instagram",
		icon: Instagram,
		color: "text-pink-600",
		bg: "bg-pink-50 dark:bg-pink-900/20",
	},
	{
		id: "youtube",
		name: "YouTube",
		icon: Youtube,
		color: "text-red-600",
		bg: "bg-red-50 dark:bg-red-900/20",
	},
	{
		id: "tiktok",
		name: "TikTok",
		icon: Zap,
		color: "text-foreground",
		bg: "bg-muted",
	},
	{
		id: "twitter",
		name: "Twitter / X",
		icon: Twitter,
		color: "text-sky-600",
		bg: "bg-sky-50 dark:bg-sky-900/20",
	},
];

const QUICK_HASHTAGS = [
	"#inteligenciaartificial",
	"#marketingdigital",
	"#videomarketing",
	"#conteudodigital",
	"#empreendedorismo",
	"#socialmedia",
	"#negocios",
	"#inovacao",
];

function getPlatformConfig(platform: SocialPlatformId) {
	return (
		PLATFORM_CONFIGS.find((item) => item.id === platform) ?? PLATFORM_CONFIGS[1]
	);
}

function getDefaultConnections(): SocialConnection[] {
	return PLATFORM_CONFIGS.map((item) => ({
		platform: item.id,
		connected: false,
		updatedAt: new Date().toISOString(),
	}));
}

function toDatetimeLocal(value: Date): string {
	const yyyy = value.getFullYear();
	const mm = String(value.getMonth() + 1).padStart(2, "0");
	const dd = String(value.getDate()).padStart(2, "0");
	const hh = String(value.getHours()).padStart(2, "0");
	const min = String(value.getMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function getInitialSchedule() {
	const now = new Date();
	now.setMinutes(now.getMinutes() + 60);
	return toDatetimeLocal(now);
}

function createId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function statusLabel(status: PostStatus) {
	if (status === "published") return "Publicado";
	if (status === "scheduled") return "Agendado";
	return "Rascunho";
}

function statusVariant(
	status: PostStatus,
): "default" | "secondary" | "outline" {
	if (status === "published") return "default";
	if (status === "scheduled") return "secondary";
	return "outline";
}

export default function RedesSociaisPage() {
	const [connections, setConnections] = useState<SocialConnection[]>(
		getDefaultConnections(),
	);
	const [posts, setPosts] = useState<SocialPost[]>([]);
	const [captionHistory, setCaptionHistory] = useState<CaptionHistoryItem[]>(
		[],
	);
	const [historyLoading, setHistoryLoading] = useState(true);

	const [selectedPlatform, setSelectedPlatform] =
		useState<SocialPlatformId>("instagram");
	const [postTitle, setPostTitle] = useState("");
	const [postCaption, setPostCaption] = useState("");
	const [scheduleAt, setScheduleAt] = useState(getInitialSchedule());
	const [editingPostId, setEditingPostId] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const rawConnections = window.localStorage.getItem(STORAGE_CONNECTIONS);
			if (rawConnections) {
				const parsed = JSON.parse(rawConnections) as SocialConnection[];
				if (Array.isArray(parsed) && parsed.length > 0) {
					const normalized = getDefaultConnections().map((defaultItem) => {
						const found = parsed.find(
							(item) => item.platform === defaultItem.platform,
						);
						return found
							? {
									...defaultItem,
									connected: Boolean(found.connected),
									handle: found.handle,
									updatedAt: found.updatedAt || defaultItem.updatedAt,
								}
							: defaultItem;
					});
					setConnections(normalized);
				}
			}

			const rawPosts = window.localStorage.getItem(STORAGE_POSTS);
			if (rawPosts) {
				const parsed = JSON.parse(rawPosts) as SocialPost[];
				if (Array.isArray(parsed)) {
					setPosts(parsed);
				}
			}
		} catch (error) {
			console.error("Falha ao carregar dados de redes sociais:", error);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(
			STORAGE_CONNECTIONS,
			JSON.stringify(connections),
		);
	}, [connections]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
	}, [posts]);

	useEffect(() => {
		fetch("/api/captions")
			.then((response) => (response.ok ? response.json() : []))
			.then((items) => {
				if (!Array.isArray(items)) return;
				const sorted = [...items].sort(
					(a: CaptionHistoryItem, b: CaptionHistoryItem) => {
						return (
							new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
						);
					},
				);
				setCaptionHistory(sorted.slice(0, 8));
			})
			.catch(() => {
				// ignore
			})
			.finally(() => setHistoryLoading(false));
	}, []);

	const selectedConnection = useMemo(
		() => connections.find((item) => item.platform === selectedPlatform),
		[connections, selectedPlatform],
	);

	const connectedCount = useMemo(
		() => connections.filter((item) => item.connected).length,
		[connections],
	);

	const scheduledCount = useMemo(
		() => posts.filter((item) => item.status === "scheduled").length,
		[posts],
	);

	const publishedCount = useMemo(
		() => posts.filter((item) => item.status === "published").length,
		[posts],
	);

	const sortedPosts = useMemo(() => {
		return [...posts].sort((a, b) => {
			return (
				new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
			);
		});
	}, [posts]);

	const resetComposer = () => {
		setPostTitle("");
		setPostCaption("");
		setScheduleAt(getInitialSchedule());
		setEditingPostId(null);
	};

	const handleToggleConnection = (platform: SocialPlatformId) => {
		setConnections((prev) => {
			const current = prev.find((item) => item.platform === platform);
			if (!current) return prev;

			if (current.connected) {
				toast.success(`${getPlatformConfig(platform).name} desconectado.`);
				return prev.map((item) =>
					item.platform === platform
						? {
								...item,
								connected: false,
								handle: undefined,
								updatedAt: new Date().toISOString(),
							}
						: item,
				);
			}

			const promptLabel = getPlatformConfig(platform).name;
			const handle = window
				.prompt(`Informe o @usuario para conectar ${promptLabel}:`, "")
				?.trim();
			if (!handle) {
				toast.info("Conexao cancelada.");
				return prev;
			}

			toast.success(`${promptLabel} conectado com sucesso.`);
			return prev.map((item) =>
				item.platform === platform
					? {
							...item,
							connected: true,
							handle,
							updatedAt: new Date().toISOString(),
						}
					: item,
			);
		});
	};

	const createOrUpdatePost = (targetStatus: PostStatus) => {
		if (!postTitle.trim()) {
			toast.error("Informe o titulo do post.");
			return;
		}

		if (!postCaption.trim()) {
			toast.error("Informe o texto/caption do post.");
			return;
		}

		if (!selectedConnection?.connected) {
			toast.error(
				`Conecte ${getPlatformConfig(selectedPlatform).name} antes de publicar.`,
			);
			return;
		}

		const scheduleDate = scheduleAt ? new Date(scheduleAt) : new Date();
		if (Number.isNaN(scheduleDate.getTime())) {
			toast.error("Data/hora de agendamento invalida.");
			return;
		}

		if (
			targetStatus === "scheduled" &&
			scheduleDate.getTime() < Date.now() - 60000
		) {
			toast.error("Escolha uma data futura para agendar.");
			return;
		}

		const nowIso = new Date().toISOString();
		const post: SocialPost = {
			id: editingPostId || createId(),
			platform: selectedPlatform,
			title: postTitle.trim(),
			caption: postCaption.trim(),
			scheduledFor:
				targetStatus === "published" ? nowIso : scheduleDate.toISOString(),
			status: targetStatus,
			createdAt: nowIso,
		};

		setPosts((prev) => {
			if (editingPostId) {
				return prev.map((item) => (item.id === editingPostId ? post : item));
			}
			return [post, ...prev];
		});

		toast.success(
			targetStatus === "published"
				? "Post marcado como publicado."
				: targetStatus === "scheduled"
					? "Post agendado com sucesso."
					: "Rascunho salvo.",
		);

		resetComposer();
	};

	const handleDeletePost = (postId: string) => {
		setPosts((prev) => prev.filter((item) => item.id !== postId));
		if (editingPostId === postId) {
			resetComposer();
		}
		toast.success("Post removido da fila.");
	};

	const handlePublishNow = (postId: string) => {
		setPosts((prev) =>
			prev.map((item) =>
				item.id === postId
					? {
							...item,
							status: "published",
							scheduledFor: new Date().toISOString(),
						}
					: item,
			),
		);
		toast.success("Post marcado como publicado agora.");
	};

	const handleEditPost = (post: SocialPost) => {
		setEditingPostId(post.id);
		setSelectedPlatform(post.platform);
		setPostTitle(post.title);
		setPostCaption(post.caption);
		setScheduleAt(toDatetimeLocal(new Date(post.scheduledFor)));
		toast.info("Post carregado no editor.");
	};

	const handleDuplicatePost = (post: SocialPost) => {
		const duplicate: SocialPost = {
			...post,
			id: createId(),
			status: "draft",
			createdAt: new Date().toISOString(),
		};
		setPosts((prev) => [duplicate, ...prev]);
		toast.success("Post duplicado como rascunho.");
	};

	const handleUseCaptionHistory = (item: CaptionHistoryItem) => {
		const normalizedPlatform = PLATFORM_CONFIGS.some(
			(config) => config.id === item.platform,
		)
			? (item.platform as SocialPlatformId)
			: "instagram";

		setSelectedPlatform(normalizedPlatform);
		setPostTitle(item.clipTitle || "Post sem titulo");
		setPostCaption(item.caption || "");
		if (typeof item.score === "number") {
			setPostCaption((prev) => `${prev}\n\n#score${item.score}`.trim());
		}
		toast.success("Caption aplicada no composer.");
	};

	const appendHashtag = (tag: string) => {
		setPostCaption((prev) => {
			if (!prev.trim()) return tag;
			if (prev.includes(tag)) return prev;
			return `${prev} ${tag}`;
		});
	};

	return (
		<div className="space-y-6 pb-14">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Redes Sociais</h1>
					<p className="text-muted-foreground mt-1">
						Publique, agende e organize seus posts em um unico painel.
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/dashboard/captions">
						<Button variant="outline" className="gap-2">
							<Sparkles className="w-4 h-4" />
							Gerar Caption IA
						</Button>
					</Link>
					<Link href="/dashboard/ai-studio">
						<Button className="gap-2">
							<Plus className="w-4 h-4" />
							Criar conteudo com IA
						</Button>
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				<Card>
					<CardContent className="pt-5">
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Contas conectadas
						</p>
						<p className="text-2xl font-bold mt-1">{connectedCount}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-5">
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Posts agendados
						</p>
						<p className="text-2xl font-bold mt-1">{scheduledCount}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-5">
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Posts publicados
						</p>
						<p className="text-2xl font-bold mt-1">{publishedCount}</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Share2 className="w-5 h-5 text-primary" />
						Contas conectadas
					</CardTitle>
					<CardDescription>
						Conexao simulada para validar o fluxo de publicacao dentro da
						plataforma.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
						{PLATFORM_CONFIGS.map((platform) => {
							const connection = connections.find(
								(item) => item.platform === platform.id,
							);
							const Icon = platform.icon;
							const connected = Boolean(connection?.connected);

							return (
								<Card
									key={platform.id}
									className={cn("border", connected && "border-primary/40")}
								>
									<CardContent className="p-4 flex flex-col items-center gap-2 text-center">
										<div
											className={cn(
												"w-12 h-12 rounded-xl flex items-center justify-center",
												platform.bg,
											)}
										>
											<Icon className={cn("w-6 h-6", platform.color)} />
										</div>
										<p className="font-medium text-sm">{platform.name}</p>
										<Badge variant={connected ? "default" : "outline"}>
											{connected ? "Conectado" : "Desconectado"}
										</Badge>
										<p className="text-[11px] text-muted-foreground min-h-4">
											{connected && connection?.handle
												? `@${connection.handle.replace(/^@/, "")}`
												: ""}
										</p>
										<Button
											variant="outline"
											size="sm"
											className="w-full text-xs"
											onClick={() => handleToggleConnection(platform.id)}
										>
											{connected ? (
												<span className="flex items-center gap-1">
													<Unplug className="w-3 h-3" />
													Desconectar
												</span>
											) : (
												"Conectar"
											)}
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Calendar className="w-5 h-5 text-primary" />
							Composer de publicacao
						</CardTitle>
						<CardDescription>
							Escolha a plataforma, monte o post e publique agora ou agende.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>Plataforma</Label>
							<div className="flex flex-wrap gap-2">
								{PLATFORM_CONFIGS.map((platform) => {
									const Icon = platform.icon;
									return (
										<button
											key={platform.id}
											type="button"
											onClick={() => setSelectedPlatform(platform.id)}
											className={cn(
												"px-3 py-2 border rounded-lg text-xs font-medium flex items-center gap-2 transition-colors",
												selectedPlatform === platform.id
													? "border-primary bg-primary/10 text-primary"
													: "border-border hover:bg-muted",
											)}
										>
											<Icon className="w-3.5 h-3.5" />
											{platform.name}
										</button>
									);
								})}
							</div>
						</div>

						{!selectedConnection?.connected && (
							<div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
								Conecte {getPlatformConfig(selectedPlatform).name} antes de
								publicar.
							</div>
						)}

						<div className="space-y-2">
							<Label>Titulo do post</Label>
							<Input
								value={postTitle}
								onChange={(event) => setPostTitle(event.target.value)}
								placeholder="Ex: 3 erros que estao travando suas vendas"
							/>
						</div>

						<div className="space-y-2">
							<Label>Texto / Caption</Label>
							<Textarea
								rows={7}
								value={postCaption}
								onChange={(event) => setPostCaption(event.target.value)}
								placeholder="Escreva a descricao do post ou use uma caption gerada pela IA..."
							/>
						</div>

						<div className="space-y-2">
							<Label>Data e hora para agendamento</Label>
							<Input
								type="datetime-local"
								value={scheduleAt}
								onChange={(event) => setScheduleAt(event.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label>Hashtags rapidas</Label>
							<div className="flex flex-wrap gap-2">
								{QUICK_HASHTAGS.map((tag) => (
									<button
										key={tag}
										type="button"
										className="px-2.5 py-1 rounded-full border text-xs hover:bg-muted"
										onClick={() => appendHashtag(tag)}
									>
										{tag}
									</button>
								))}
							</div>
						</div>

						<Separator />

						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								onClick={() => createOrUpdatePost("draft")}
							>
								Salvar rascunho
							</Button>
							<Button
								variant="outline"
								onClick={() => createOrUpdatePost("scheduled")}
							>
								Agendar
							</Button>
							<Button onClick={() => createOrUpdatePost("published")}>
								Publicar agora
							</Button>
							{(editingPostId || postTitle || postCaption) && (
								<Button variant="ghost" onClick={resetComposer}>
									Limpar
								</Button>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Sparkles className="w-5 h-5 text-primary" />
							Captions recentes da IA
						</CardTitle>
						<CardDescription>
							Clique em uma caption para preencher automaticamente o composer.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{historyLoading ? (
							<p className="text-sm text-muted-foreground">
								Carregando captions...
							</p>
						) : captionHistory.length === 0 ? (
							<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								Nenhuma caption encontrada. Gere uma em "Captions IA" para usar
								aqui.
							</div>
						) : (
							captionHistory.map((item) => (
								<div key={item.id} className="rounded-lg border p-3 space-y-2">
									<div className="flex items-center justify-between gap-2">
										<p className="text-sm font-medium truncate">
											{item.clipTitle}
										</p>
										<Badge variant="outline" className="text-[11px]">
											{item.platform}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-2">
										{item.caption}
									</p>
									<Button
										size="sm"
										variant="outline"
										className="text-xs"
										onClick={() => handleUseCaptionHistory(item)}
									>
										<Copy className="w-3.5 h-3.5 mr-1" />
										Usar no composer
									</Button>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Clock3 className="w-5 h-5 text-primary" />
						Fila de posts
					</CardTitle>
					<CardDescription>
						Acompanhe rascunhos, agendamentos e publicacoes feitas.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{sortedPosts.length === 0 ? (
						<div className="rounded-lg border border-dashed p-10 text-center space-y-2 text-muted-foreground">
							<p className="font-medium">Nenhum post na fila</p>
							<p className="text-sm">
								Crie seu primeiro agendamento no composer acima.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{sortedPosts.map((post) => {
								const platform = getPlatformConfig(post.platform);
								const Icon = platform.icon;

								return (
									<div key={post.id} className="rounded-lg border p-3 md:p-4">
										<div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
											<div className="space-y-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<span
														className={cn(
															"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
															platform.bg,
														)}
													>
														<Icon
															className={cn("w-3.5 h-3.5", platform.color)}
														/>
														{platform.name}
													</span>
													<Badge variant={statusVariant(post.status)}>
														{statusLabel(post.status)}
													</Badge>
												</div>
												<p className="font-medium truncate">{post.title}</p>
												<p className="text-xs text-muted-foreground line-clamp-2">
													{post.caption}
												</p>
												<p className="text-xs text-muted-foreground">
													{post.status === "published"
														? "Publicado em"
														: "Programado para"}{" "}
													{new Date(post.scheduledFor).toLocaleString("pt-BR")}
												</p>
											</div>

											<div className="flex items-center gap-1.5 flex-wrap">
												{post.status !== "published" && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => handlePublishNow(post.id)}
													>
														<CheckCircle2 className="w-3.5 h-3.5 mr-1" />
														Publicar agora
													</Button>
												)}
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleEditPost(post)}
												>
													Editar
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleDuplicatePost(post)}
												>
													Duplicar
												</Button>
												<Button
													size="sm"
													variant="destructive"
													onClick={() => handleDeletePost(post.id)}
												>
													<Trash2 className="w-3.5 h-3.5 mr-1" />
													Excluir
												</Button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
