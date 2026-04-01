import { WordMap } from "./word-map";
import type { WordMetadata } from "./types";

const mockWords: WordMetadata[] = [
	{ id: "1", text: "Inovação", start: 10.0, end: 10.5, confidence: 0.99, isPunctuation: false },
	{ id: "2", text: "é", start: 10.6, end: 10.7, confidence: 0.99, isPunctuation: false },
	{ id: "3", text: "conexão", start: 10.8, end: 11.5, confidence: 0.99, isPunctuation: false },
	{ id: "4", text: "entre", start: 11.6, end: 12.0, confidence: 0.99, isPunctuation: false },
	{ id: "5", text: "pessoas", start: 12.1, end: 12.8, confidence: 0.99, isPunctuation: false },
];

console.log("--- PHASE 1 VERIFICATION ---");

const engine = new WordMap(mockWords);

// Test 1: Indexing
const w1 = engine.getWord("1");
if (w1?.text === "Inovação") {
	console.log("✅ Word indexing: PASSED");
} else {
	console.error("❌ Word indexing: FAILED");
	process.exit(1);
}

// Test 2: Signature
const w3 = engine.getWord("3");
if (w3?.signature?.before.includes("inovação") && w3?.signature?.after.includes("entre")) {
	console.log("✅ Context Lock Signature: PASSED");
} else {
	console.error("❌ Context Lock Signature: FAILED");
	process.exit(1);
}

// Test 3: Phrase Finding
const range = engine.findPhrase("conexão entre", 11.0);
if (range?.startId === "3" && range?.endId === "4") {
	console.log("✅ Contextual Phrase Finding: PASSED");
} else {
	console.error("❌ Contextual Phrase Finding: FAILED", range);
	process.exit(1);
}

// Test 4: Integrity
const integrity = engine.verifyIntegrity();
if (integrity.isValid) {
	console.log("✅ Integrity Verification: PASSED");
} else {
	console.error("❌ Integrity Verification: FAILED");
	process.exit(1);
}

console.log("--- ALL PHASE 1 TESTS PASSED ---");
