import type { TranscriptionSegment, CaptionChunk } from "@/types/transcription";
import {
	DEFAULT_WORDS_PER_CAPTION,
	MIN_CAPTION_DURATION_SECONDS,
} from "@/constants/transcription-constants";

export function buildCaptionChunks({
	segments,
	wordsPerChunk = DEFAULT_WORDS_PER_CAPTION,
	minDuration = MIN_CAPTION_DURATION_SECONDS,
}: {
	segments: TranscriptionSegment[];
	wordsPerChunk?: number;
	minDuration?: number;
}): CaptionChunk[] {
	const captions: CaptionChunk[] = [];

	if (!segments || segments.length === 0) return [];

	for (const segment of segments) {
		const segmentStart = Number.isFinite(segment.start) ? Math.max(0, segment.start) : 0;
		const segmentEnd = Number.isFinite(segment.end) ? Math.max(segmentStart + 0.1, segment.end) : segmentStart + 0.1;

		// Se temos timestamps por palavra, usamos eles para maior precisão
		if (segment.words && segment.words.length > 0) {
			const words = segment.words;
			for (let i = 0; i < words.length; i += wordsPerChunk) {
				const chunkWords = words.slice(i, i + wordsPerChunk);
				const chunkText = chunkWords
					.map((w) => w.word)
					.join(" ")
					.trim();
				if (!chunkText) continue;

				const startTime = Number.isFinite(chunkWords[0].start) 
					? Math.max(segmentStart, chunkWords[0].start) 
					: segmentStart;
				
				const endTime = Number.isFinite(chunkWords[chunkWords.length - 1].end)
					? Math.max(startTime + 0.1, chunkWords[chunkWords.length - 1].end)
					: segmentEnd;

				const duration = Math.max(minDuration, endTime - startTime);

				captions.push({
					text: chunkText,
					startTime: startTime,
					duration: duration,
				});
			}
			continue;
		}

		// Fallback para interpolação linear se não houver timestamps por palavra
		const words = segment.text.trim().split(/\s+/);
		if (words.length === 0 || (words.length === 1 && words[0] === "")) continue;

		const segmentDuration = Math.max(0.1, segmentEnd - segmentStart);
		const durationPerWord = segmentDuration / words.length;

		for (let i = 0; i < words.length; i += wordsPerChunk) {
			const chunkWords = words.slice(i, i + wordsPerChunk);
			const chunkText = chunkWords.join(" ");
			if (!chunkText.trim()) continue;

			const startTime = segmentStart + i * durationPerWord;

			let duration = durationPerWord * chunkWords.length;

			if (i + wordsPerChunk >= words.length) {
				duration = segmentEnd - startTime;
			}

			captions.push({
				text: chunkText,
				startTime: startTime,
				duration: Math.max(minDuration, duration),
			});
		}
	}

	return captions;
}
