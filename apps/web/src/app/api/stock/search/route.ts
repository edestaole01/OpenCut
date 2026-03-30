import { webEnv } from "@opencut/env/web";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

type PexelsPhoto = {
	id: number | string;
	alt?: string;
	photographer?: string;
	src: { medium: string; original: string };
	width: number;
	height: number;
};

type PexelsVideoFile = {
	quality?: string;
	file_type?: string;
	link: string;
	width?: number;
	height?: number;
};

type PexelsVideo = {
	id: number | string;
	image: string;
	width: number;
	height: number;
	duration: number;
	user?: { name?: string };
	video_files?: PexelsVideoFile[];
};

type GiphyImage = {
	url?: string;
	mp4?: string;
	width?: string | number;
	height?: string | number;
};

type GiphyGif = {
	id: string;
	title?: string;
	username?: string;
	images?: {
		original?: GiphyImage;
		fixed_height_small?: GiphyImage;
		fixed_height?: GiphyImage;
	};
};

const searchParamsSchema = z.object({
	q: z.string().max(500).optional(),
	provider: z.enum(["pexels", "giphy"]).default("pexels"),
	page: z.coerce.number().int().min(1).max(100).default(1),
	per_page: z.coerce.number().int().min(1).max(40).default(20),
});

export interface StockItem {
	id: string;
	provider: "pexels" | "giphy";
	type: "image" | "video" | "gif";
	name: string;
	previewUrl: string;
	downloadUrl: string;
	width: number;
	height: number;
	duration?: number;
	attribution?: string;
}

export interface StockSearchResponse {
	results: StockItem[];
	totalResults: number;
	page: number;
	perPage: number;
	hasMore: boolean;
}

async function searchPexelsPhotos({
	query,
	page,
	perPage,
	apiKey,
}: {
	query: string;
	page: number;
	perPage: number;
	apiKey: string;
}): Promise<StockItem[]> {
	const params = new URLSearchParams({
		query,
		page: page.toString(),
		per_page: Math.ceil(perPage / 2).toString(),
		orientation: "landscape",
	});

	const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
		headers: { Authorization: apiKey },
	});

	if (!res.ok) return [];

	const data = await res.json();
	return (data.photos ?? []).map((p: PexelsPhoto) => ({
		id: `pexels-photo-${p.id}`,
		provider: "pexels" as const,
		type: "image" as const,
		name: p.alt || `Photo by ${p.photographer}`,
		previewUrl: p.src.medium,
		downloadUrl: p.src.original,
		width: p.width,
		height: p.height,
		attribution: p.photographer,
	}));
}

async function searchPexelsVideos({
	query,
	page,
	perPage,
	apiKey,
}: {
	query: string;
	page: number;
	perPage: number;
	apiKey: string;
}): Promise<StockItem[]> {
	const params = new URLSearchParams({
		query,
		page: page.toString(),
		per_page: Math.ceil(perPage / 2).toString(),
	});

	const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
		headers: { Authorization: apiKey },
	});

	if (!res.ok) return [];

	const data = await res.json();
	return (data.videos ?? [])
		.map((v: PexelsVideo) => {
			const hdFile = (v.video_files ?? []).find(
				(f: PexelsVideoFile) =>
					f.quality === "hd" && f.file_type === "video/mp4",
			);
			const sdFile = (v.video_files ?? []).find(
				(f: PexelsVideoFile) =>
					f.quality === "sd" && f.file_type === "video/mp4",
			);
			const file = hdFile ?? sdFile ?? v.video_files?.[0];
			if (!file) return null;

			return {
				id: `pexels-video-${v.id}`,
				provider: "pexels" as const,
				type: "video" as const,
				name: `Video by ${v.user?.name ?? "Pexels"}`,
				previewUrl: v.image,
				downloadUrl: file.link,
				width: v.width,
				height: v.height,
				duration: v.duration,
				attribution: v.user?.name,
			};
		})
		.filter(Boolean);
}

async function searchGiphy({
	query,
	page,
	perPage,
	apiKey,
}: {
	query: string;
	page: number;
	perPage: number;
	apiKey: string;
}): Promise<{ items: StockItem[]; totalCount: number }> {
	const offset = (page - 1) * perPage;
	const endpoint = query
		? "https://api.giphy.com/v1/gifs/search"
		: "https://api.giphy.com/v1/gifs/trending";

	const params = new URLSearchParams({
		api_key: apiKey,
		limit: perPage.toString(),
		offset: offset.toString(),
		rating: "g",
	});
	if (query) params.set("q", query);

	const res = await fetch(`${endpoint}?${params}`);
	if (!res.ok) return { items: [], totalCount: 0 };

	const data = await res.json();
	const items: StockItem[] = (data.data ?? [])
		.map((g: GiphyGif) => {
			const original = g.images?.original;
			const preview = g.images?.fixed_height_small ?? g.images?.fixed_height;
			if (!original?.url) return null;

			const mp4Url = original.mp4 ?? null;
			const downloadUrl = mp4Url ?? original.url;
			const mimeType = mp4Url ? "video/mp4" : "image/gif";

			return {
				id: `giphy-${g.id}`,
				provider: "giphy" as const,
				type: "gif" as const,
				name: g.title || "GIF",
				previewUrl: preview?.url ?? original.url,
				downloadUrl,
				width: Number(original.width) || 480,
				height: Number(original.height) || 270,
				attribution: g.username || "Giphy",
				_mimeType: mimeType,
			};
		})
		.filter(Boolean);

	return {
		items,
		totalCount: data.pagination?.total_count ?? items.length,
	};
}

export async function GET(request: NextRequest) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { searchParams } = new URL(request.url);
		const validation = searchParamsSchema.safeParse({
			q: searchParams.get("q") || undefined,
			provider: searchParams.get("provider") || undefined,
			page: searchParams.get("page") || undefined,
			per_page: searchParams.get("per_page") || undefined,
		});

		if (!validation.success) {
			return NextResponse.json(
				{
					error: "Invalid parameters",
					details: validation.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { q: query, provider, page, per_page: perPage } = validation.data;

		if (provider === "pexels") {
			const apiKey = webEnv.PEXELS_API_KEY;
			if (!apiKey) {
				return NextResponse.json<StockSearchResponse>({
					results: [],
					totalResults: 0,
					page,
					perPage,
					hasMore: false,
				});
			}

			const searchQuery = query || "nature";
			const [photos, videos] = await Promise.all([
				searchPexelsPhotos({ query: searchQuery, page, perPage, apiKey }),
				searchPexelsVideos({ query: searchQuery, page, perPage, apiKey }),
			]);

			// Interleave photos and videos
			const results: StockItem[] = [];
			const maxLen = Math.max(photos.length, videos.length);
			for (let i = 0; i < maxLen; i++) {
				if (photos[i]) results.push(photos[i]);
				if (videos[i]) results.push(videos[i]);
			}

			return NextResponse.json<StockSearchResponse>({
				results: results.slice(0, perPage),
				totalResults: results.length,
				page,
				perPage,
				hasMore: results.length >= perPage,
			});
		}

		// Giphy
		const apiKey = webEnv.GIPHY_API_KEY;
		if (!apiKey) {
			return NextResponse.json<StockSearchResponse>({
				results: [],
				totalResults: 0,
				page,
				perPage,
				hasMore: false,
			});
		}

		const { items, totalCount } = await searchGiphy({
			query: query ?? "",
			page,
			perPage,
			apiKey,
		});

		return NextResponse.json<StockSearchResponse>({
			results: items,
			totalResults: totalCount,
			page,
			perPage,
			hasMore: (page - 1) * perPage + items.length < totalCount,
		});
	} catch (error) {
		console.error("Stock search error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
