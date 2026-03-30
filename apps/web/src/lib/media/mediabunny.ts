import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from "mediabunny";
import { createWavBlob } from "@/utils/audio";
import { collectAudioMixSources } from "@/lib/media/audio";
import type { TimelineTrack } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";

export async function getVideoInfo({
	videoFile,
}: {
	videoFile: File;
}): Promise<{
	duration: number;
	width: number;
	height: number;
	fps: number;
}> {
	const input = new Input({
		source: new BlobSource(videoFile),
		formats: ALL_FORMATS,
	});

	const duration = await input.computeDuration();
	const videoTrack = await input.getPrimaryVideoTrack();

	if (!videoTrack) {
		throw new Error("No video track found in the file");
	}

	const packetStats = await videoTrack.computePacketStats(100);
	const fps = packetStats.averagePacketRate;

	return {
		duration,
		width: videoTrack.displayWidth,
		height: videoTrack.displayHeight,
		fps,
	};
}

const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;

export const extractTimelineAudio = async ({
	tracks,
	mediaAssets,
	totalDuration,
	onProgress,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	totalDuration: number;
	onProgress?: (progress: number) => void;
}): Promise<Blob> => {
	if (totalDuration === 0) {
		return createWavBlob({
			samples: new Float32Array(SAMPLE_RATE * 0.1),
			sampleRate: SAMPLE_RATE,
		});
	}

	const audioMixSources = await collectAudioMixSources({
		tracks,
		mediaAssets,
	});

	if (audioMixSources.length === 0) {
		const silentDuration = Math.max(1, totalDuration);
		const silentSamples = new Float32Array(
			Math.ceil(silentDuration * SAMPLE_RATE) * NUM_CHANNELS,
		);
		return createWavBlob({ samples: silentSamples, sampleRate: SAMPLE_RATE });
	}

	const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE);
	const mixBuffers = Array.from(
		{ length: NUM_CHANNELS },
		() => new Float32Array(totalSamples),
	);

	for (let i = 0; i < audioMixSources.length; i++) {
		const source = audioMixSources[i];

		if (onProgress) {
			onProgress((i / audioMixSources.length) * 90);
		}

		try {
			await decodeAndMixAudioSource({
				source,
				mixBuffers,
				totalSamples,
			});
		} catch (error) {
			console.warn(
				`Failed to process audio source ${source.file.name}:`,
				error,
			);
		}
	}

	// clamp to prevent clipping
	for (const channel of mixBuffers) {
		for (let i = 0; i < channel.length; i++) {
			channel[i] = Math.max(-1, Math.min(1, channel[i]));
		}
	}

	// interleave channels for wav output
	const interleavedSamples = new Float32Array(totalSamples * NUM_CHANNELS);
	for (let i = 0; i < totalSamples; i++) {
		for (let ch = 0; ch < NUM_CHANNELS; ch++) {
			interleavedSamples[i * NUM_CHANNELS + ch] = mixBuffers[ch][i];
		}
	}

	if (onProgress) {
		onProgress(100);
	}

	return createWavBlob({
		samples: interleavedSamples,
		sampleRate: SAMPLE_RATE,
	});
};

async function decodeAndMixAudioSource({
	source,
	mixBuffers,
	totalSamples,
}: {
	source: {
		file: File;
		startTime: number;
		duration: number;
		trimStart: number;
	};
	mixBuffers: Float32Array[];
	totalSamples: number;
}): Promise<void> {
	const input = new Input({
		source: new BlobSource(source.file),
		formats: ALL_FORMATS,
	});

	const audioTrack = await input.getPrimaryAudioTrack();
	if (!audioTrack) return;

	const sink = new AudioBufferSink(audioTrack);
	const trimEnd = source.trimStart + source.duration;

	for await (const { buffer, timestamp } of sink.buffers(
		source.trimStart,
		trimEnd,
	)) {
		const relativeTime = timestamp - source.trimStart;
		const outputStartSample = Math.floor(
			(source.startTime + relativeTime) * SAMPLE_RATE,
		);

		// resample if needed
		const resampleRatio = SAMPLE_RATE / buffer.sampleRate;

		for (let ch = 0; ch < NUM_CHANNELS; ch++) {
			const sourceChannel = Math.min(ch, buffer.numberOfChannels - 1);
			const channelData = buffer.getChannelData(sourceChannel);
			const outputChannel = mixBuffers[ch];

			const resampledLength = Math.floor(channelData.length * resampleRatio);
			for (let i = 0; i < resampledLength; i++) {
				const outputIdx = outputStartSample + i;
				if (outputIdx < 0 || outputIdx >= totalSamples) continue;

				const sourceIdx = Math.floor(i / resampleRatio);
				if (sourceIdx < channelData.length) {
					outputChannel[outputIdx] += channelData[sourceIdx];
				}
			}
		}
	}
}
