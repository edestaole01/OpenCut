"use client";
import { useRef, useState, useCallback, useEffect } from "react";
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
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const load = useCallback(async (): Promise<FFmpeg> => {
		// Reuse existing instance
		if (globalFFmpeg?.loaded) {
			ffmpegRef.current = globalFFmpeg;
			if (mountedRef.current) setIsReady(true);
			return globalFFmpeg;
		}

		// If already loading, wait for the shared promise
		if (loadPromise) {
			if (mountedRef.current) setIsLoading(true);
			try {
				await loadPromise;
				if (!globalFFmpeg) {
					throw new Error("FFmpeg failed to initialize");
				}
				ffmpegRef.current = globalFFmpeg;
				if (mountedRef.current) {
					setIsReady(true);
					setIsLoading(false);
				}
				return globalFFmpeg;
			} catch (e) {
				if (mountedRef.current) setIsLoading(false);
				throw e;
			}
		}

		if (mountedRef.current) {
			setIsLoading(true);
			setLoadError(null);
		}

		const ffmpeg = new FFmpeg();
		ffmpeg.on("progress", ({ progress: p }) => {
			if (mountedRef.current) setProgress(Math.round(p * 100));
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
			if (mountedRef.current) setIsReady(true);
		} catch (e) {
			loadPromise = null;
			if (mountedRef.current)
				setLoadError("Erro ao carregar FFmpeg. Verifique sua conexão.");
			throw e;
		} finally {
			if (mountedRef.current) setIsLoading(false);
		}

		return ffmpeg;
	}, []);

	return {
		ffmpegRef,
		load,
		isLoading,
		isReady,
		loadError,
		progress,
		setProgress,
	};
}
