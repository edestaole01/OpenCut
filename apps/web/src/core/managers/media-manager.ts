import type { EditorCore } from "@/core";
import type { MediaAsset } from "@/types/assets";
import { storageService } from "@/services/storage/service";
import { generateUUID } from "@/utils/id";
import { videoCache } from "@/services/video-cache/service";
import { hasMediaId } from "@/lib/timeline/element-utils";
import { generateThumbnail } from "@/lib/media/processing";

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
	}): Promise<string> {
		let normalizedAsset = asset;
		if (asset.type === "video" && !asset.thumbnailUrl) {
			try {
				normalizedAsset = {
					...asset,
					thumbnailUrl: await generateThumbnail({
						videoFile: asset.file,
						timeInSeconds: 1,
					}),
				};
			} catch (error) {
				console.warn(
					"Failed to generate video thumbnail during addMediaAsset:",
					error,
				);
			}
		}

		const newAsset: MediaAsset = {
			...normalizedAsset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			return newAsset.id;
		} catch (error) {
			console.warn(
				"Failed to persist media asset. Keeping it in memory for this session:",
				error,
			);
			this.assets = this.assets.map((asset) =>
				asset.id === newAsset.id ? { ...asset, ephemeral: true } : asset,
			);
			this.notify();
			return newAsset.id;
		}
	}

	async removeMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((asset) => asset.id === id);

		videoCache.clearVideo({ mediaId: id });

		if (asset?.url) {
			URL.revokeObjectURL(asset.url);
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		}

		this.assets = this.assets.filter((asset) => asset.id !== id);
		this.notify();

		const tracks = this.editor.timeline.getTracks();
		const elementsToRemove: Array<{ trackId: string; elementId: string }> = [];

		for (const track of tracks) {
			for (const element of track.elements) {
				if (hasMediaId(element) && element.mediaId === id) {
					elementsToRemove.push({ trackId: track.id, elementId: element.id });
				}
			}
		}

		if (elementsToRemove.length > 0) {
			this.editor.timeline.deleteElements({ elements: elementsToRemove });
		}

		try {
			await storageService.deleteMediaAsset({ projectId, id });
		} catch (error) {
			console.error("Failed to delete media asset:", error);
		}
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;
			this.notify();
			void this.ensureVideoThumbnails({ projectId });
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => {
			fn();
		});
	}

	private async ensureVideoThumbnails({
		projectId,
	}: {
		projectId: string;
	}): Promise<void> {
		const missingThumbnailVideos = this.assets.filter(
			(asset) => asset.type === "video" && !asset.thumbnailUrl,
		);
		if (missingThumbnailVideos.length === 0) {
			return;
		}

		let hasUpdates = false;
		let nextAssets = [...this.assets];
		const updatedAssets: MediaAsset[] = [];

		for (const asset of missingThumbnailVideos) {
			try {
				const thumbnailUrl = await generateThumbnail({
					videoFile: asset.file,
					timeInSeconds: 1,
				});
				if (!thumbnailUrl) {
					continue;
				}

				nextAssets = nextAssets.map((existing) =>
					existing.id === asset.id ? { ...existing, thumbnailUrl } : existing,
				);
				updatedAssets.push({ ...asset, thumbnailUrl });
				hasUpdates = true;
			} catch (error) {
				console.warn(
					`Failed to backfill thumbnail for video asset ${asset.id}:`,
					error,
				);
			}
		}

		if (!hasUpdates) {
			return;
		}

		this.assets = nextAssets;
		this.notify();

		await Promise.all(
			updatedAssets.map((asset) =>
				storageService
					.saveMediaAsset({ projectId, mediaAsset: asset })
					.catch((error) => {
						console.error("Failed to persist media asset thumbnail:", error);
					}),
			),
		);
	}
}
