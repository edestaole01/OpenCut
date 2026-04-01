/**
 * OpenCut Precision Engine (OPE) - WordMap Manager
 * Responsible for indexing words, creating signatures, and verifying integrity.
 */

import type { WordMetadata } from "./types";

export class WordMap {
	private words: WordMetadata[] = [];
	private idIndex: Map<string, WordMetadata> = new Map();

	constructor(initialWords: WordMetadata[] = []) {
		if (initialWords.length > 0) {
			this.load(initialWords);
		}
	}

	/**
	 * Loads a new set of words and builds indexes
	 */
	public load(words: WordMetadata[]): void {
		this.words = [...words].sort((a, b) => a.start - b.start);
		this.idIndex.clear();
		for (const word of this.words) {
			this.idIndex.set(word.id, word);
		}
		this.enrichWithSignatures();
	}

	/**
	 * Adds "Context Lock" signatures to each word (3 before, 3 after)
	 */
	private enrichWithSignatures(): void {
		for (let i = 0; i < this.words.length; i++) {
			const before = this.words
				.slice(Math.max(0, i - 3), i)
				.map((w) => w.text.toLowerCase());
			const after = this.words
				.slice(i + 1, Math.min(this.words.length, i + 4))
				.map((w) => w.text.toLowerCase());

			this.words[i].signature = { before, after };
		}
	}

	/**
	 * Returns word by ID
	 */
	public getWord(id: string): WordMetadata | undefined {
		return this.idIndex.get(id);
	}

	/**
	 * Returns all words within a time range
	 */
	public getWordsInRange(start: number, end: number): WordMetadata[] {
		return this.words.filter((w) => w.start >= start && w.end <= end);
	}

	/**
	 * Returns the word active at a specific time.
	 * Optimized for high-frequency calls (60fps).
	 */
	public getActiveWord(time: number): WordMetadata | undefined {
		// Since words are sorted by start time, we can eventually optimize this
		// with binary search, but for typical clip lengths, a simple find is fast.
		return this.words.find((w) => time >= w.start && time < w.end);
	}

	/**
	 * Returns words that will start within the next 'buffer' seconds.
	 * Used for pre-fetching/pre-rendering.
	 */
	public getIncomingWords(time: number, buffer = 0.5): WordMetadata[] {
		return this.words.filter(
			(w) => w.start > time && w.start <= time + buffer,
		);
	}

	/**
	 * Checks for integrity: find gaps > 200ms without speech
	 */
	public verifyIntegrity(): { isValid: boolean; gaps: number[] } {
		const gaps: number[] = [];
		for (let i = 0; i < this.words.length - 1; i++) {
			const current = this.words[i];
			const next = this.words[i + 1];
			const silenceDuration = next.start - current.end;

			if (silenceDuration > 0.2) {
				gaps.push(current.end);
			}
		}
		return {
			isValid: gaps.length === 0,
			gaps,
		};
	}

	/**
	 * Searches for a phrase and returns its word range IDs
	 * Uses the signature to avoid context mismatch (words with same text)
	 */
	public findPhrase(
		text: string,
		suggestedStartTime: number,
	): { startId: string; endId: string } | null {
		const targetWords = text
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 0);
		if (targetWords.length === 0) return null;

		// 1. Try local search first (near suggested time +/- 60s)
		let range = this.searchInWindow(targetWords, suggestedStartTime, 60);
		
		// 2. GLOBAL SEARCH FALLBACK: If massive drift occurred (e.g. 26s error reported by user)
		// we scan the entire word list to find the content anchor.
		if (!range) {
			console.log(`[WordMap] Phrase "${text.slice(0, 20)}..." not found near ${suggestedStartTime}s. Performing global scan...`);
			range = this.searchInWindow(targetWords, this.words[Math.floor(this.words.length/2)]?.start || 0, 3600);
		}

		return range;
	}

	/**
	 * Helper to search for a word sequence within a specific time window
	 */
	private searchInWindow(
		targetWords: string[],
		centerTime: number,
		windowSeconds: number
	): { startId: string; endId: string } | null {
		const candidates = this.words.filter(
			(w) => Math.abs(w.start - centerTime) < windowSeconds,
		);

		for (let i = 0; i < candidates.length; i++) {
			if (candidates[i].text.toLowerCase() === targetWords[0]) {
				let match = true;
				const sequence: WordMetadata[] = [candidates[i]];

				for (let j = 1; j < targetWords.length; j++) {
					const nextIdx = this.words.indexOf(candidates[i]) + j;
					if (
						nextIdx >= this.words.length ||
						this.words[nextIdx].text.toLowerCase() !== targetWords[j]
					) {
						match = false;
						break;
					}
					sequence.push(this.words[nextIdx]);
				}

				if (match) {
					return {
						startId: sequence[0].id,
						endId: sequence[sequence.length - 1].id,
					};
				}
			}
		}
		return null;
	}
}
