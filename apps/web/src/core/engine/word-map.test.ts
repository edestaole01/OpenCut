import { expect, test, describe } from "bun:test";
import { WordMap } from "./word-map";
import type { WordMetadata } from "./types";

describe("WordMap Core Logic", () => {
	const mockWords: WordMetadata[] = [
		{
			id: "1",
			text: "Inovação",
			start: 10.0,
			end: 10.5,
			confidence: 0.99,
			isPunctuation: false,
		},
		{
			id: "2",
			text: "é",
			start: 10.6,
			end: 10.7,
			confidence: 0.99,
			isPunctuation: false,
		},
		{
			id: "3",
			text: "conexão",
			start: 10.8,
			end: 11.5,
			confidence: 0.99,
			isPunctuation: false,
		},
		{
			id: "4",
			text: "entre",
			start: 11.6,
			end: 12.0,
			confidence: 0.99,
			isPunctuation: false,
		},
		{
			id: "5",
			text: "pessoas",
			start: 12.1,
			end: 12.8,
			confidence: 0.99,
			isPunctuation: false,
		},
	];

	test("should index words correctly", () => {
		const engine = new WordMap(mockWords);
		expect(engine.getWord("1")?.text).toBe("Inovação");
		expect(engine.getWord("5")?.text).toBe("pessoas");
	});

	test("should create signatures for contextual locking", () => {
		const engine = new WordMap(mockWords);
		const word3 = engine.getWord("3");
		expect(word3?.signature?.before).toContain("inovação");
		expect(word3?.signature?.after).toContain("entre");
	});

	test("should find a phrase near a suggested time", () => {
		const engine = new WordMap(mockWords);
		const range = engine.findPhrase("conexão entre", 11.0);
		expect(range?.startId).toBe("3");
		expect(range?.endId).toBe("4");
	});

	test("should verify integrity and find silence gaps", () => {
		const engine = new WordMap(mockWords);
		// Silence between 11.5 and 11.6 is 0.1s (valid)
		// Silence between 10.7 and 10.8 is 0.1s (valid)
		expect(engine.verifyIntegrity().isValid).toBe(true);

		// Add a large gap
		const wordsWithGap = [
			...mockWords,
			{
				id: "6",
				text: "fim",
				start: 15.0,
				end: 15.5,
				confidence: 0.9,
				isPunctuation: false,
			},
		];
		const engineWithGap = new WordMap(wordsWithGap);
		const integrity = engineWithGap.verifyIntegrity();
		expect(integrity.isValid).toBe(false);
		expect(integrity.gaps).toContain(12.8); // Silence starts at end of word 5
	});
});
