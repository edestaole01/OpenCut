import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	aiUsageLog,
	aiVideoAnalyses,
	generatedCaptions,
} from "@/lib/db/schema";

type DayStats = {
	date: string;
	videos: number;
	clips: number;
	captions: number;
};

function toDayKey(date: Date) {
	return date.toISOString().slice(0, 10);
}

function createLastDays(days: number): DayStats[] {
	const today = new Date();
	const list: DayStats[] = [];

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(today.getDate() - i);
		list.push({
			date: toDayKey(d),
			videos: 0,
			clips: 0,
			captions: 0,
		});
	}

	return list;
}

function toNumber(value: unknown, fallback = 0): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	return fallback;
}

export async function GET(req: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userId = session.user.id;

		const [analyses, captions, usage] = await Promise.all([
			db
				.select({
					id: aiVideoAnalyses.id,
					videoName: aiVideoAnalyses.videoName,
					videoSize: aiVideoAnalyses.videoSize,
					result: aiVideoAnalyses.result,
					createdAt: aiVideoAnalyses.createdAt,
				})
				.from(aiVideoAnalyses)
				.where(eq(aiVideoAnalyses.userId, userId))
				.orderBy(desc(aiVideoAnalyses.createdAt)),
			db
				.select({
					id: generatedCaptions.id,
					platform: generatedCaptions.platform,
					clipTitle: generatedCaptions.clipTitle,
					score: generatedCaptions.score,
					createdAt: generatedCaptions.createdAt,
				})
				.from(generatedCaptions)
				.where(eq(generatedCaptions.userId, userId))
				.orderBy(desc(generatedCaptions.createdAt)),
			db
				.select({
					id: aiUsageLog.id,
					feature: aiUsageLog.feature,
					provider: aiUsageLog.provider,
					tokensUsed: aiUsageLog.tokensUsed,
					costUsd: aiUsageLog.costUsd,
					createdAt: aiUsageLog.createdAt,
				})
				.from(aiUsageLog)
				.where(eq(aiUsageLog.userId, userId))
				.orderBy(desc(aiUsageLog.createdAt)),
		]);

		const trend = createLastDays(14);
		const trendByDay = new Map(trend.map((day) => [day.date, day]));

		const topTagMap = new Map<string, number>();
		const clipRows: Array<{
			videoName: string;
			title: string;
			tag: string;
			score: number;
			duration: number;
		}> = [];

		let clipsGenerated = 0;
		let scoreSum = 0;
		let scoreCount = 0;
		let mockAnalyses = 0;
		let realTranscriptCount = 0;

		for (const analysis of analyses) {
			const result = (analysis.result ?? {}) as Record<string, unknown>;
			const clips = Array.isArray(result.clips)
				? (result.clips as Array<Record<string, unknown>>)
				: [];
			const day = trendByDay.get(toDayKey(new Date(analysis.createdAt)));
			if (day) {
				day.videos += 1;
				day.clips += clips.length;
			}

			clipsGenerated += clips.length;
			if (result.isMock === true || result.transcriptSource === "mock") {
				mockAnalyses += 1;
			} else if (
				typeof result.transcript === "string" &&
				result.transcript.trim().length > 0
			) {
				realTranscriptCount += 1;
			}

			for (const clip of clips) {
				const score = toNumber(clip.score, -1);
				const start = toNumber(clip.start, 0);
				const end = toNumber(clip.end, 0);
				const duration = Math.max(0, end - start);
				const tag =
					typeof clip.tag === "string" && clip.tag.trim().length > 0
						? clip.tag
						: "Sem tag";
				const title =
					typeof clip.title === "string" && clip.title.trim().length > 0
						? clip.title
						: "Clip sem titulo";

				topTagMap.set(tag, (topTagMap.get(tag) ?? 0) + 1);

				if (score >= 0) {
					scoreSum += score;
					scoreCount += 1;
				}

				clipRows.push({
					videoName: analysis.videoName,
					title,
					tag,
					score: score >= 0 ? score : 0,
					duration,
				});
			}
		}

		const captionsByPlatform = new Map<string, number>();
		let captionScoreSum = 0;
		let captionScoreCount = 0;
		for (const item of captions) {
			const platform =
				typeof item.platform === "string" && item.platform.trim().length > 0
					? item.platform
					: "unknown";
			captionsByPlatform.set(
				platform,
				(captionsByPlatform.get(platform) ?? 0) + 1,
			);

			const day = trendByDay.get(toDayKey(new Date(item.createdAt)));
			if (day) day.captions += 1;

			if (typeof item.score === "number" && Number.isFinite(item.score)) {
				captionScoreSum += item.score;
				captionScoreCount += 1;
			}
		}

		const usageByFeature = new Map<string, number>();
		const usageByProvider = new Map<string, number>();
		let tokensUsedTotal = 0;
		let costUsdTotal = 0;
		for (const row of usage) {
			const feature =
				typeof row.feature === "string" && row.feature.trim().length > 0
					? row.feature
					: "unknown";
			const provider =
				typeof row.provider === "string" && row.provider.trim().length > 0
					? row.provider
					: "unknown";

			usageByFeature.set(feature, (usageByFeature.get(feature) ?? 0) + 1);
			usageByProvider.set(provider, (usageByProvider.get(provider) ?? 0) + 1);

			tokensUsedTotal += toNumber(row.tokensUsed, 0);
			costUsdTotal += toNumber(row.costUsd, 0);
		}

		const avgViralScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
		const avgCaptionScore =
			captionScoreCount > 0 ? captionScoreSum / captionScoreCount : 0;
		const estimatedViews = Math.round(
			clipRows.reduce((acc, row) => acc + row.score * row.score * 2.2, 0),
		);
		const estimatedHoursSaved = Number((clipsGenerated * 0.2).toFixed(1));
		const transcriptCoverage =
			analyses.length > 0 ? realTranscriptCount / analyses.length : 0;

		const topTags = [...topTagMap.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([tag, count]) => ({ tag, count }));

		const topClips = clipRows
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((clip) => ({
				...clip,
				score: Number(clip.score.toFixed(1)),
			}));

		return NextResponse.json({
			summary: {
				videosAnalyzed: analyses.length,
				clipsGenerated,
				captionsGenerated: captions.length,
				avgViralScore: Number(avgViralScore.toFixed(1)),
				avgCaptionScore: Number(avgCaptionScore.toFixed(1)),
				estimatedViews,
				estimatedHoursSaved,
				transcriptCoverage: Number((transcriptCoverage * 100).toFixed(1)),
				mockAnalyses,
			},
			topTags,
			topClips,
			trend,
			captionsByPlatform: [...captionsByPlatform.entries()].map(
				([platform, count]) => ({
					platform,
					count,
				}),
			),
			usage: {
				totalCalls: usage.length,
				tokensUsedTotal,
				costUsdTotal: Number(costUsdTotal.toFixed(4)),
				byFeature: [...usageByFeature.entries()].map(([feature, count]) => ({
					feature,
					count,
				})),
				byProvider: [...usageByProvider.entries()].map(([provider, count]) => ({
					provider,
					count,
				})),
			},
		});
	} catch (error) {
		console.error("Analytics fetch error:", error);
		return NextResponse.json(
			{ error: "Erro ao gerar analytics" },
			{ status: 500 },
		);
	}
}
