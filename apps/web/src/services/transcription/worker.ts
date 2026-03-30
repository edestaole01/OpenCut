import {
	env,
	pipeline,
	type AutomaticSpeechRecognitionPipeline,
	type AutomaticSpeechRecognitionOutput,
} from "@huggingface/transformers";
import type { TranscriptionSegment } from "@/types/transcription";
import {
	DEFAULT_CHUNK_LENGTH_SECONDS,
	DEFAULT_STRIDE_SECONDS,
} from "@/constants/transcription-constants";

export type WorkerMessage =
	| { type: "init"; modelId: string }
	| { type: "transcribe"; audio: Float32Array; language: string }
	| { type: "cancel" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| { type: "transcribe-progress"; progress: number }
	| {
			type: "transcribe-complete";
			text: string;
			segments: TranscriptionSegment[];
	  }
	| { type: "transcribe-error"; error: string }
	| { type: "cancelled" };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

function configureRuntime() {
	try {
		env.allowLocalModels = false;
		(env as { logLevel?: string }).logLevel = "error";
	} catch (_e) {}
}

function handleProgress(progressInfo: {
	status?: string;
	file?: string;
	progress?: number;
	loaded?: number;
	total?: number;
}) {
	if (cancelled) return;

	if (
		progressInfo.file &&
		typeof progressInfo.loaded === "number" &&
		typeof progressInfo.total === "number" &&
		progressInfo.total > 0
	) {
		fileBytes.set(progressInfo.file, {
			loaded: progressInfo.loaded,
			total: progressInfo.total,
		});
	}

	let percent = 0;
	if (fileBytes.size > 0) {
		let loaded = 0;
		let total = 0;
		for (const item of fileBytes.values()) {
			loaded += item.loaded;
			total += item.total;
		}
		if (total > 0) percent = Math.round((loaded / total) * 100);
	} else if (typeof progressInfo.progress === "number") {
		percent = Math.round(progressInfo.progress * 100);
	}

	percent = Math.max(0, Math.min(100, percent));
	if (percent === lastReportedProgress) return;
	lastReportedProgress = percent;

	self.postMessage({
		type: "init-progress",
		progress: percent,
	} satisfies WorkerResponse);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;
	if (message.type === "cancel") {
		cancelled = true;
		return;
	}

	configureRuntime();

	if (message.type === "init") {
		try {
			transcriber = (await pipeline(
				"automatic-speech-recognition",
				message.modelId,
				{
					device: "wasm",
					progress_callback: handleProgress,
				},
			)) as unknown as AutomaticSpeechRecognitionPipeline;
			self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
		} catch (error: unknown) {
			self.postMessage({
				type: "init-error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	if (message.type === "transcribe") {
		if (!transcriber) return;
		cancelled = false;

		try {
			const rawResult = await transcriber(message.audio, {
				chunk_length_s: DEFAULT_CHUNK_LENGTH_SECONDS,
				stride_length_s: DEFAULT_STRIDE_SECONDS,
				language: message.language === "auto" ? undefined : message.language,
				return_timestamps: true,
				// Parâmetros para evitar alucinações ("não não não")
				repetition_penalty: 1.2,
				no_repeat_ngram_size: 3,
			});

			const result: AutomaticSpeechRecognitionOutput = Array.isArray(rawResult)
				? rawResult[0]
				: rawResult;
			const segments: TranscriptionSegment[] = [];
			if (result.chunks) {
				for (const chunk of result.chunks) {
					if (chunk.timestamp) {
						segments.push({
							text: chunk.text,
							start: chunk.timestamp[0] ?? 0,
							end: chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0,
						});
					}
				}
			}

			self.postMessage({
				type: "transcribe-complete",
				text: result.text,
				segments,
			} satisfies WorkerResponse);
		} catch (error: unknown) {
			self.postMessage({
				type: "transcribe-error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
};
