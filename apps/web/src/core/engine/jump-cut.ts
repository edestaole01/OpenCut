/**
 * OpenCut Precision Engine (OPE) - JumpCut Engine
 * Automates silence removal and boundary trimming using WordMetadata.
 */

import type { WordMetadata } from "./types";

export class JumpCutEngine {
	/**
	 * Analyzes a range and returns the "tight" speech boundaries.
	 * Removes silences at the start and end of a suggested clip.
	 */
	public static trimToSpeech(
		words: WordMetadata[],
		suggestedStart: number,
		suggestedEnd: number,
	): { start: number; end: number } {
		if (words.length === 0) return { start: suggestedStart, end: suggestedEnd };

		// Sort words just in case
		const sortedWords = [...words].sort((a, b) => a.start - b.start);

		// The true start is the start of the first spoken word
		const speechStart = sortedWords[0].start;
		
		// The true end is the end of the last spoken word
		const speechEnd = sortedWords[sortedWords.length - 1].end;

		return {
			start: speechStart,
			end: speechEnd,
		};
	}

	/**
	 * Identifies gaps between words that are longer than the threshold.
	 * Returns a list of segments to be "cut out" from the timeline.
	 */
	public static findSilenceGaps(
		words: WordMetadata[],
		minSilenceDuration = 0.5,
	): Array<{ start: number; end: number }> {
		const gaps: Array<{ start: number; end: number }> = [];

		for (let i = 0; i < words.length - 1; i++) {
			const current = words[i];
			const next = words[i + 1];
			const silenceDuration = next.start - current.end;

			if (silenceDuration >= minSilenceDuration) {
				gaps.push({
					start: current.end,
					end: next.start,
				});
			}
		}

		return gaps;
	}
}
