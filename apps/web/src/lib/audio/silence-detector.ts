export interface SilentSegment {
	start: number;
	end: number;
	duration: number;
}

export interface SilenceDetectionResult {
	silentSegments: SilentSegment[];
	speechSegments: Array<{ start: number; end: number }>;
	totalSilence: number;
	totalSpeech: number;
}

export async function detectSilenceFromAudioBuffer(
	audioBuffer: AudioBuffer,
	threshold = 0.01,
	minSilenceSec = 0.4,
): Promise<SilenceDetectionResult> {
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;
	const mono = new Float32Array(length);

	for (let c = 0; c < numChannels; c++) {
		const channel = audioBuffer.getChannelData(c);
		for (let i = 0; i < length; i++) {
			mono[i] += Math.abs(channel[i]) / numChannels;
		}
	}

	const sampleRate = audioBuffer.sampleRate;
	const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
	const numWindows = Math.floor(length / windowSize);
	const minSilenceWindows = Math.ceil(minSilenceSec / 0.05);

	const isSilent: boolean[] = [];
	for (let w = 0; w < numWindows; w++) {
		let maxAmp = 0;
		const start = w * windowSize;
		const end = Math.min(start + windowSize, length);
		for (let i = start; i < end; i++) {
			if (mono[i] > maxAmp) maxAmp = mono[i];
		}
		isSilent.push(maxAmp < threshold);
	}

	const silentSegments: SilentSegment[] = [];
	let silenceStart = -1;
	let silenceCount = 0;

	for (let w = 0; w <= numWindows; w++) {
		if (w < numWindows && isSilent[w]) {
			if (silenceStart === -1) {
				silenceStart = w;
				silenceCount = 0;
			}
			silenceCount++;
		} else {
			if (silenceStart !== -1 && silenceCount >= minSilenceWindows) {
				const start = (silenceStart * windowSize) / sampleRate;
				const end = ((silenceStart + silenceCount) * windowSize) / sampleRate;
				silentSegments.push({ start, end, duration: end - start });
			}
			silenceStart = -1;
			silenceCount = 0;
		}
	}

	const duration = audioBuffer.duration;
	const totalSilence = silentSegments.reduce((s, seg) => s + seg.duration, 0);

	const speechSegments: Array<{ start: number; end: number }> = [];
	const PADDING = 0.15; // 150ms padding for natural speech cuts

	let pos = 0;
	for (const seg of silentSegments) {
		if (seg.start > pos + 0.1) {
			// Add padding to the start and end of speech
			const start = Math.max(0, pos - (pos > 0 ? PADDING : 0));
			const end = seg.start + PADDING;
			speechSegments.push({ start, end });
		}
		pos = seg.end;
	}
	if (pos < duration - 0.1) {
		const start = Math.max(0, pos - PADDING);
		const end = Math.min(duration, duration);
		speechSegments.push({ start, end });
	}

	// Post-process to merge overlapping segments caused by padding
	const mergedSegments: Array<{ start: number; end: number }> = [];
	if (speechSegments.length > 0) {
		let current = { ...speechSegments[0] };
		for (let i = 1; i < speechSegments.length; i++) {
			if (speechSegments[i].start < current.end) {
				current.end = Math.max(current.end, speechSegments[i].end);
			} else {
				mergedSegments.push(current);
				current = { ...speechSegments[i] };
			}
		}
		mergedSegments.push(current);
	}

	return {
		silentSegments,
		speechSegments: mergedSegments,
		totalSilence,
		totalSpeech: duration - totalSilence,
	};
}
