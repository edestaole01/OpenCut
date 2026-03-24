"use client";
import { useState, useCallback } from "react";

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

export function useSilenceDetector() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SilenceDetectionResult | null>(null);

  const detectSilence = useCallback(async (
    videoFile: File,
    threshold = 0.01,      // amplitude min (0-1)
    minSilenceSec = 0.4    // min silence duration in seconds
  ): Promise<SilenceDetectionResult> => {
    setIsAnalyzing(true);

    try {
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      // Mix all channels to mono
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

      // Detect silent windows
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

      // Merge consecutive silent windows into segments
      const silentSegments: SilentSegment[] = [];
      let silenceStart = -1;
      let silenceCount = 0;

      for (let w = 0; w <= numWindows; w++) {
        if (w < numWindows && isSilent[w]) {
          if (silenceStart === -1) { silenceStart = w; silenceCount = 0; }
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

      // Invert to get speech segments
      const speechSegments: Array<{ start: number; end: number }> = [];
      let pos = 0;
      for (const seg of silentSegments) {
        if (seg.start > pos + 0.1) {
          speechSegments.push({ start: pos, end: seg.start });
        }
        pos = seg.end;
      }
      if (pos < duration - 0.1) {
        speechSegments.push({ start: pos, end: duration });
      }

      const res: SilenceDetectionResult = {
        silentSegments,
        speechSegments,
        totalSilence,
        totalSpeech: duration - totalSilence,
      };

      setResult(res);
      return res;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { detectSilence, isAnalyzing, result };
}
