"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { useEditor } from "@/hooks/use-editor";
import { useDebounce } from "@/hooks/use-debounce";
import { processMediaAssets } from "@/lib/media/processing";
import { toast } from "sonner";
import Image from "next/image";
import {
	Search01Icon,
	Image02Icon,
	Video01Icon,
	GifIcon,
	PlusSignIcon,
	CheckmarkCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
	StockItem,
	StockSearchResponse,
} from "@/app/api/stock/search/route";

type Provider = "pexels" | "giphy";

export function StockView() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	const [provider, setProvider] = useState<Provider>("pexels");
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedQuery = useDebounce(searchQuery, 400);

	const [results, setResults] = useState<StockItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [page, setPage] = useState(1);

	// Per-item state: "idle" | "adding" | "added"
	const [itemStates, setItemStates] = useState<
		Record<string, "adding" | "added">
	>({});
	// Map from stock item ID → real media asset ID (for drag data)
	const [assetIds, setAssetIds] = useState<Record<string, string>>({});

	const abortRef = useRef<AbortController | null>(null);

	const fetchResults = useCallback(
		async ({
			query,
			prov,
			pageNum,
		}: {
			query: string;
			prov: Provider;
			pageNum: number;
		}) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			setIsLoading(true);
			try {
				const params = new URLSearchParams({
					provider: prov,
					page: pageNum.toString(),
					per_page: "20",
				});
				if (query) params.set("q", query);

				const res = await fetch(`/api/stock/search?${params}`, {
					signal: controller.signal,
				});
				if (!res.ok) throw new Error("Busca falhou");

				const data: StockSearchResponse = await res.json();

				setResults((prev) =>
					pageNum === 1 ? data.results : [...prev, ...data.results],
				);
				setHasMore(data.hasMore);
			} catch (err: unknown) {
				if ((err as { name?: string })?.name !== "AbortError") {
					toast.error("Falha ao carregar mídia stock");
				}
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	// Re-fetch when query or provider changes
	useEffect(() => {
		setPage(1);
		setResults([]);
		fetchResults({ query: debouncedQuery, prov: provider, pageNum: 1 });
	}, [debouncedQuery, provider, fetchResults]);

	const handleLoadMore = useCallback(() => {
		const nextPage = page + 1;
		setPage(nextPage);
		fetchResults({ query: debouncedQuery, prov: provider, pageNum: nextPage });
	}, [page, debouncedQuery, provider, fetchResults]);

	const handleSwitchProvider = useCallback((prov: Provider) => {
		setProvider(prov);
		setSearchQuery("");
		setResults([]);
		setPage(1);
		setItemStates({});
		setAssetIds({});
	}, []);

	const handleAddItem = useCallback(
		async (item: StockItem) => {
			if (itemStates[item.id] === "adding" || itemStates[item.id] === "added")
				return;

			setItemStates((prev) => ({ ...prev, [item.id]: "adding" }));

			try {
				const proxyUrl = `/api/stock/proxy?url=${encodeURIComponent(item.downloadUrl)}`;
				const res = await fetch(proxyUrl);
				if (!res.ok) throw new Error("Falha ao baixar mídia");

				const blob = await res.blob();
				const ext =
					item.type === "video" ||
					(item.type === "gif" && blob.type === "video/mp4")
						? "mp4"
						: item.type === "gif"
							? "gif"
							: "jpg";
				const mimeType =
					blob.type ||
					(ext === "mp4"
						? "video/mp4"
						: ext === "gif"
							? "image/gif"
							: "image/jpeg");
				const file = new File([blob], `${item.name}.${ext}`, {
					type: mimeType,
				});

				const [processed] = await processMediaAssets({ files: [file] });
				if (!processed) throw new Error("Falha ao processar");

				const assetId = await editor.media.addMediaAsset({
					projectId: activeProject.id,
					asset: processed,
				});

				setAssetIds((prev) => ({ ...prev, [item.id]: assetId }));
				setItemStates((prev) => ({ ...prev, [item.id]: "added" }));
				toast.success(`"${item.name}" adicionado ao projeto`);
			} catch (err) {
				console.error("Falha ao adicionar item stock:", err);
				toast.error(`Falha ao adicionar "${item.name}"`);
				setItemStates((prev) => {
					const next = { ...prev };
					delete next[item.id];
					return next;
				});
			}
		},
		[itemStates, editor.media, activeProject.id],
	);

	const noApiKey = results.length === 0 && !isLoading;

	return (
		<PanelView
			title="Mídia Stock"
			actions={
				<div className="bg-muted flex items-center rounded-md p-0.5">
					<Button
						variant={provider === "pexels" ? "secondary" : "ghost"}
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() => handleSwitchProvider("pexels")}
					>
						Pexels
					</Button>
					<Button
						variant={provider === "giphy" ? "secondary" : "ghost"}
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() => handleSwitchProvider("giphy")}
					>
						Giphy
					</Button>
				</div>
			}
		>
			<div className="flex h-full flex-col gap-3">
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={
							provider === "pexels" ? "Buscar vídeos e fotos…" : "Buscar GIFs…"
						}
						className="bg-muted focus-visible:ring-ring w-full rounded-md py-2 pr-3 pl-9 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2"
					/>
				</div>

				{isLoading && results.length === 0 ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner className="text-muted-foreground size-6" />
					</div>
				) : noApiKey && !debouncedQuery ? (
					<div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm">
						<p>
							Configure a variável{" "}
							{provider === "pexels" ? "PEXELS_API_KEY" : "GIPHY_API_KEY"} no
							seu ambiente para ativar a mídia stock.
						</p>
					</div>
				) : results.length === 0 && !isLoading ? (
					<div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
						Nenhum resultado encontrado
					</div>
				) : (
					<div className="flex-1 overflow-y-auto pr-1">
						<div className="grid grid-cols-2 gap-2">
							{results.map((item) => (
								<StockItemCard
									key={item.id}
									item={item}
									state={itemStates[item.id]}
									assetId={assetIds[item.id]}
									onAdd={() => handleAddItem(item)}
								/>
							))}
						</div>
						{hasMore && (
							<div className="mt-3 flex justify-center">
								<Button
									variant="secondary"
									size="sm"
									className="text-xs"
									onClick={handleLoadMore}
									disabled={isLoading}
								>
									{isLoading ? <Spinner className="size-3" /> : "Carregar mais"}
								</Button>
							</div>
						)}
					</div>
				)}

				<p className="text-muted-foreground shrink-0 text-center text-xs">
					{provider === "pexels" ? "Fotos e vídeos do Pexels" : "GIFs do Giphy"}
				</p>
			</div>
		</PanelView>
	);
}

function StockItemCard({
	item,
	state,
	assetId,
	onAdd,
}: {
	item: StockItem;
	state?: "adding" | "added";
	assetId?: string;
	onAdd: () => void;
}) {
	const typeIcon =
		item.type === "video"
			? Video01Icon
			: item.type === "gif"
				? GifIcon
				: Image02Icon;

	const mediaType = item.type === "video" ? "video" : "image";

	const preview = (
		<div className="relative size-full overflow-hidden rounded-sm">
			<Image
				src={item.previewUrl}
				alt={item.name}
				fill
				className="object-cover transition-transform duration-200 group-hover:scale-105"
				unoptimized
			/>
			<div className="absolute right-1 bottom-1 flex items-center gap-1">
				<div className="rounded bg-black/60 p-0.5">
					<HugeiconsIcon icon={typeIcon} className="size-3 text-white" />
				</div>
			</div>
			{state !== "added" && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onAdd();
					}}
					className="absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
					title="Adicionar ao projeto"
				>
					{state === "adding" ? (
						<Spinner className="size-3" />
					) : (
						<HugeiconsIcon icon={PlusSignIcon} className="size-3" />
					)}
				</button>
			)}
			{state === "added" && (
				<div className="absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-green-600/80">
					<HugeiconsIcon
						icon={CheckmarkCircleIcon}
						className="size-3 text-white"
					/>
				</div>
			)}
		</div>
	);

	if (state === "added" && assetId) {
		return (
			<DraggableItem
				name={item.name}
				preview={preview}
				dragData={{
					id: assetId,
					type: "media",
					mediaType,
					name: item.name,
				}}
				aspectRatio={item.width / item.height}
				variant="card"
				containerClassName="w-full group"
			/>
		);
	}

	return (
		<button
			type="button"
			className="group relative w-full cursor-pointer overflow-hidden rounded-md"
			style={{ aspectRatio: item.width / item.height }}
			onClick={state !== "adding" ? onAdd : undefined}
			onKeyDown={(e) =>
				(e.key === "Enter" || e.key === " ") && state !== "adding" && onAdd()
			}
			title={
				state === "adding"
					? "Adicionando…"
					: `Adicionar "${item.name}" ao projeto`
			}
		>
			{preview}
		</button>
	);
}
