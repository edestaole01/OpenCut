"use client";
import { useRef, useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const FFMPEG_BASE_URL = "/ffmpeg";

let globalFFmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const load = useCallback(async (): Promise<FFmpeg> => {
    // Reuse existing instance
    if (globalFFmpeg?.loaded) {
      ffmpegRef.current = globalFFmpeg;
      setIsReady(true);
      return globalFFmpeg;
    }

    // If already loading, wait
    if (loadPromise) {
      await loadPromise;
      ffmpegRef.current = globalFFmpeg!;
      setIsReady(true);
      return globalFFmpeg!;
    }

    setIsLoading(true);
    setLoadError(null);

    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }) => {
      setProgress(Math.round(p * 100));
    });

    loadPromise = (async () => {
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      globalFFmpeg = ffmpeg;
    })();

    try {
      await loadPromise;
      ffmpegRef.current = ffmpeg;
      setIsReady(true);
    } catch (e) {
      loadPromise = null;
      setLoadError("Erro ao carregar FFmpeg. Verifique sua conexão.");
      throw e;
    } finally {
      setIsLoading(false);
    }

    return ffmpeg;
  }, []);

  return { ffmpegRef, load, isLoading, isReady, loadError, progress, setProgress };
}
