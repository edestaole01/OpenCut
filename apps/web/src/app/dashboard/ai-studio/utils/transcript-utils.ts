export const formatTime = (s: number) => {
	const m = Math.floor(s / 60);
	const sec = Math.round((s % 60) * 10) / 10;
	return `${m.toString().padStart(2, "0")}:${sec < 10 ? "0" : ""}${sec.toFixed(1).replace(".0", "")}`;
};

export function parseTimestampedTranscriptSegments(
	transcript: string,
): Array<{ start: number; end: number; text: string }> {
	if (!transcript) return [];

	const markerRegex =
		/(?:^|[\s\n])(?:\[|\()?([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?(?:[.,]([0-9]{1,3}))?(?:\]|\))?\s*[-:]?\s*/g;

	interface Marker {
		time: number;
		rawTag: string;
		index: number;
	}

	const markers: Marker[] = [];
	for (
		let m = markerRegex.exec(transcript);
		m !== null;
		m = markerRegex.exec(transcript)
	) {
		const first = Number(m[1]);
		const second = Number(m[2]);
		const third = m[3] !== undefined ? Number(m[3]) : undefined;
		const milliseconds = m[4] !== undefined ? Number(m[4].padEnd(3, "0")) : 0;

		let time =
			third !== undefined
				? first * 3600 + second * 60 + third
				: first * 60 + second;

		time += milliseconds / 1000;

		markers.push({ time, rawTag: m[0], index: m.index });
	}

	if (markers.length === 0) return [];

	const segments: Array<{ start: number; end: number; text: string }> = [];
	for (let i = 0; i < markers.length; i++) {
		const tagEnd = markers[i].index + markers[i].rawTag.length;
		const textEnd =
			i + 1 < markers.length ? markers[i + 1].index : transcript.length;
		const text = transcript.slice(tagEnd, textEnd).trim();
		const start = markers[i].time;

		// End = start of the NEXT segment (mirrors server-side extractTimestampSegments).
		// Last segment extends to POSITIVE_INFINITY so it always overlaps with any
		// clip window that includes it.
		const end =
			i + 1 < markers.length ? markers[i + 1].time : Number.POSITIVE_INFINITY;

		if (text) segments.push({ start, end, text });
	}

	return segments;
}

export function getClipTranscriptSegments(
	transcript: string,
	startSec: number,
	endSec: number,
): Array<{ start: number; end: number; text: string }> {
	const segments = parseTimestampedTranscriptSegments(transcript);
	if (segments.length === 0) return [];
	// Strict overlap: segment ending exactly at clip start (overlap=0) is excluded.
	// Segments that genuinely overlap the clip window are included.
	return segments.filter((s) => {
		const overlap = Math.min(s.end, endSec) - Math.max(s.start, startSec);
		return overlap > 0;
	});
}

export function extractClipTranscript(
	transcript: string,
	startSec: number,
	endSec: number,
): string {
	if (!transcript) return "";
	const relevantSegments = getClipTranscriptSegments(
		transcript,
		startSec,
		endSec,
	);
	if (relevantSegments.length === 0) {
		return `(Trecho ${formatTime(startSec)} -> ${formatTime(endSec)} - sem transcrição específica para este momento)`;
	}
	return relevantSegments
		.map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
		.join("\n");
}

export function sanitizeCaptionText(raw: string): string {
	return raw
		.replace(
			/(?:\[|\()?([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?(?:\]|\))?\s*[-:]?/g,
			" ",
		)
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeTranscriptText(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

export function isMissingSpecificTranscript(raw: string): boolean {
	return normalizeTranscriptText(raw).includes("sem transcricao especifica");
}

export function hasTimestampMarkers(raw: string): boolean {
	return /(?:\[|\()?([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?(?:\]|\))?/.test(
		raw,
	);
}

export function isDemoTranscript(raw: string): boolean {
	const normalized = normalizeTranscriptText(raw);
	return (
		normalized.includes("modo demonstracao") ||
		normalized.includes("modo demo") ||
		normalized.includes("analise falhou ou foi simulada") ||
		normalized.includes("nao e transcricao real do video") ||
		normalized.includes("gemini api nao conseguiu processar o video") ||
		normalized.includes("quando funcionar, aparecera assim")
	);
}

export function isAudioCueOnlyTranscript(raw: string): boolean {
	const normalized = normalizeTranscriptText(raw).trim();
	if (!normalized) return false;
	const audioCueOnlyPattern =
		/^(?:\[(?:musica|music|som|sons|aplausos|risos|ruido|noise|silencio)\]\s*)+$/;
	if (audioCueOnlyPattern.test(normalized)) return true;
	return (
		normalized === "musica" ||
		normalized === "[musica]" ||
		normalized === "music" ||
		normalized === "[music]"
	);
}

export function wrapCaptionText(raw: string, maxCharsPerLine = 18): string {
	const text = sanitizeCaptionText(raw);
	if (!text) return "";
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";
	for (const word of words) {
		if (!currentLine) {
			currentLine = word;
			continue;
		}
		const candidate = `${currentLine} ${word}`;
		if (candidate.length <= maxCharsPerLine) {
			currentLine = candidate;
		} else {
			lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines.join("\n");
}

export function isDefaultTimelineText(raw: string | undefined): boolean {
	const normalized = normalizeTranscriptText(raw ?? "");
	return (
		normalized === "default text" ||
		normalized === "cole ou edite a transcricao aqui." ||
		normalized === "cole ou edite a transcricao aqui"
	);
}

export const scoreColor = (s: number) =>
	s >= 80 ? "text-green-500" : s >= 60 ? "text-yellow-500" : "text-red-500";

export const scoreBg = (s: number) =>
	s >= 80
		? "border-green-500/40 bg-green-500/5"
		: s >= 60
			? "border-yellow-500/40 bg-yellow-500/5"
			: "border-red-500/40 bg-red-500/5";

export const tagColor: Record<string, string> = {
	Gancho:
		"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
	Tutorial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	Story: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
	Dica: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
	CTA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
