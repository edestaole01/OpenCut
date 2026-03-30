import type {
	TranscriptionLanguage,
	TranscriptionResult,
	TranscriptionProgress,
	TranscriptionModelId,
} from "@/types/transcription";
import {
	DEFAULT_TRANSCRIPTION_MODEL,
	SUPPORTED_TRANSCRIPTION_LANGS,
	TRANSCRIPTION_MODELS,
} from "@/constants/transcription-constants";
import type { WorkerMessage, WorkerResponse } from "./worker";
import type { LanguageCode } from "@/types/language";
import { createWavBlob } from "@/utils/audio";

type ProgressCallback = (progress: TranscriptionProgress) => void;

function resolveLanguage({
	language,
}: {
	language: TranscriptionLanguage;
}): LanguageCode {
	if (language !== "auto") return language;

	if (typeof navigator !== "undefined") {
		const browserLanguage = navigator.language
			.toLowerCase()
			.split("-")[0] as LanguageCode;
		if (SUPPORTED_TRANSCRIPTION_LANGS.includes(browserLanguage)) {
			return browserLanguage;
		}
	}

	return "pt";
}

class TranscriptionService {
	private worker: Worker | null = null;
	private currentModelId: TranscriptionModelId | null = null;
	private isInitialized = false;
	private isInitializing = false;

	async transcribe({
		audioData,
		samples, // Opcional: Float32Array para fallback local
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		onProgress,
		useRemote = true,
		sampleRate = 16000,
	}: {
		audioData: Float32Array | Blob;
		samples?: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		onProgress?: ProgressCallback;
		useRemote?: boolean;
		sampleRate?: number;
	}): Promise<TranscriptionResult> {
		const resolvedLanguage = resolveLanguage({ language });

		if (useRemote) {
			try {
				return await this.transcribeRemote({
					audioData,
					language: resolvedLanguage,
					onProgress,
					sampleRate,
				});
			} catch (error) {
				console.warn(
					"[Transcription] Remote transcription failed, falling back to local...",
					error,
				);
				// Se falhar o remoto, tentamos o local se tivermos samples (ou se audioData for samples)
				const localSamples =
					samples || (audioData instanceof Float32Array ? audioData : null);
				if (!localSamples) {
					throw error;
				}

				await this.ensureWorker({ modelId, onProgress });
				return this.runTranscription({
					audioData: localSamples,
					language: resolvedLanguage,
					onProgress,
				});
			}
		}

		const localSamples =
			samples || (audioData instanceof Float32Array ? audioData : null);
		if (!localSamples) {
			throw new Error("Local transcription requires Float32Array samples");
		}

		await this.ensureWorker({ modelId, onProgress });
		return this.runTranscription({
			audioData: localSamples,
			language: resolvedLanguage,
			onProgress,
		});
	}

	private async transcribeRemote({
		audioData,
		language,
		onProgress,
		sampleRate = 16000,
	}: {
		audioData: Float32Array | Blob;
		language: LanguageCode;
		onProgress?: ProgressCallback;
		sampleRate?: number;
	}): Promise<TranscriptionResult> {
		onProgress?.({
			status: "transcribing",
			progress: 10,
			message: "Enviando para transcrição ultra-rápida (Groq)...",
		});

		const formData = new FormData();

		if (audioData instanceof Blob) {
			formData.append("file", audioData, "audio.wav");
		} else {
			const wavBlob = createWavBlob({
				samples: audioData,
				sampleRate: sampleRate,
				numChannels: 1,
			});
			formData.append("file", wavBlob, "audio.wav");
		}

		formData.append("language", language);

		const response = await fetch("/api/transcribe", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Erro na transcrição remota");
		}

		onProgress?.({
			status: "transcribing",
			progress: 90,
			message: "Finalizando transcrição...",
		});

		return await response.json();
	}

	cancel() {
		this.worker?.postMessage({ type: "cancel" } satisfies WorkerMessage);
	}

	private async ensureWorker({
		modelId,
		onProgress,
	}: {
		modelId: TranscriptionModelId;
		onProgress?: ProgressCallback;
	}): Promise<void> {
		const needsNewModel = this.currentModelId !== modelId;

		if (this.worker && this.isInitialized && !needsNewModel) {
			return;
		}

		if (this.isInitializing && !needsNewModel) {
			await this.waitForInit();
			return;
		}

		const modelCandidates = this.getModelCandidates(modelId);
		let lastError: Error | null = null;

		for (const candidateId of modelCandidates) {
			const candidate = TRANSCRIPTION_MODELS.find((m) => m.id === candidateId);
			if (!candidate) continue;

			try {
				await this.initWorkerForModel({
					requestedModelId: modelId,
					modelId: candidateId,
					onProgress,
				});
				return;
			} catch (error) {
				lastError =
					error instanceof Error
						? error
						: new Error("Failed to initialize model");

				console.warn(
					`[Transcription] Model ${candidate.name} failed, trying fallback...`,
					lastError.message,
				);
			}
		}

		throw (
			lastError ??
			new Error("Unable to initialize any transcription model in the browser.")
		);
	}

	private getModelCandidates(preferredModelId: TranscriptionModelId) {
		const fallbackOrder: TranscriptionModelId[] = [
			preferredModelId,
			"whisper-small",
			"whisper-medium",
			"whisper-tiny",
			"whisper-large-v3",
			"whisper-large-v3-turbo",
		];

		return [...new Set(fallbackOrder)];
	}

	private async initWorkerForModel({
		requestedModelId,
		modelId,
		onProgress,
	}: {
		requestedModelId: TranscriptionModelId;
		modelId: TranscriptionModelId;
		onProgress?: ProgressCallback;
	}): Promise<void> {
		const model = TRANSCRIPTION_MODELS.find((m) => m.id === modelId);
		if (!model) {
			throw new Error(`Unknown model: ${modelId}`);
		}

		this.terminate();
		this.isInitializing = true;
		this.isInitialized = false;

		this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
		});

		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("Failed to create worker"));
				return;
			}

			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;

				switch (response.type) {
					case "init-progress":
						onProgress?.({
							status: "loading-model",
							progress: response.progress,
							message: `Loading ${model.name} model...`,
						});
						break;

					case "init-complete":
						this.worker?.removeEventListener("message", handleMessage);
						this.isInitialized = true;
						this.isInitializing = false;
						this.currentModelId = requestedModelId;
						resolve();
						break;

					case "init-error":
						this.worker?.removeEventListener("message", handleMessage);
						this.isInitializing = false;
						this.terminate();
						reject(new Error(response.error));
						break;
				}
			};

			this.worker.addEventListener("message", handleMessage);

			this.worker.postMessage({
				type: "init",
				modelId: model.huggingFaceId,
			} satisfies WorkerMessage);
		});
	}

	private runTranscription({
		audioData,
		language,
		onProgress,
	}: {
		audioData: Float32Array;
		language: LanguageCode;
		onProgress?: ProgressCallback;
	}): Promise<TranscriptionResult> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("Worker not initialized"));
				return;
			}

			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;

				switch (response.type) {
					case "transcribe-progress":
						onProgress?.({
							status: "transcribing",
							progress: response.progress,
							message: "Transcribing audio...",
						});
						break;

					case "transcribe-complete":
						this.worker?.removeEventListener("message", handleMessage);
						resolve({
							text: response.text,
							segments: response.segments,
							language,
						});
						break;

					case "transcribe-error":
						this.worker?.removeEventListener("message", handleMessage);
						reject(new Error(response.error));
						break;

					case "cancelled":
						this.worker?.removeEventListener("message", handleMessage);
						reject(new Error("Transcription cancelled"));
						break;
				}
			};

			this.worker.addEventListener("message", handleMessage);

			this.worker.postMessage({
				type: "transcribe",
				audio: audioData,
				language,
			} satisfies WorkerMessage);
		});
	}

	private waitForInit(): Promise<void> {
		return new Promise((resolve) => {
			const checkInit = () => {
				if (this.isInitialized) {
					resolve();
				} else if (!this.isInitializing) {
					resolve();
				} else {
					setTimeout(checkInit, 100);
				}
			};
			checkInit();
		});
	}

	terminate() {
		this.worker?.terminate();
		this.worker = null;
		this.isInitialized = false;
		this.isInitializing = false;
		this.currentModelId = null;
	}
}

export const transcriptionService = new TranscriptionService();
