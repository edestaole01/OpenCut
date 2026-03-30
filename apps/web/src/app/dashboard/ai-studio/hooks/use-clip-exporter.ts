"use client";
import { useState, useCallback } from "react";
import { fetchFile } from "@ffmpeg/util";
import { useFFmpeg } from "./use-ffmpeg";
import { downloadBuffer } from "@/lib/export";

export interface ColorGradingOpts {
	brightness: number; // -1 to 1, default 0
	contrast: number; // 0 to 3, default 1
	saturation: number; // 0 to 3, default 1
}

export interface CaptionOpts {
	text: string;
	style: "tiktok" | "traditional" | "none";
	fontSize: number;
	color: string;
}

export interface WatermarkOpts {
	file: File | null;
	position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
	opacity: number; // 0 to 1
}

export interface ExportOptions {
	clip: { id: string; title: string; start: number; end: number };
	videoFile: File;
	format: "original" | "vertical" | "square";
	colorGrading?: ColorGradingOpts;
	caption?: CaptionOpts;
	watermark?: WatermarkOpts;
	speechSegments?: Array<{ start: number; end: number }>;
}

type ExportStatus = "idle" | "loading-ffmpeg" | "processing" | "done" | "error";

export function useClipExporter() {
	const { load, isLoading, progress, setProgress } = useFFmpeg();
	const [status, setStatus] = useState<ExportStatus>("idle");
	const [error, setError] = useState<string | null>(null);

	const exportClip = useCallback(
		async (opts: ExportOptions) => {
			setStatus("loading-ffmpeg");
			setError(null);

			let ffmpeg: Awaited<ReturnType<typeof load>>;
			try {
				ffmpeg = await load();
			} catch {
				setStatus("error");
				setError("Falha ao carregar FFmpeg. Verifique sua conexão.");
				return;
			}

			setStatus("processing");
			setProgress(0);

			const inputName = `input_${Date.now()}.mp4`;
			const outputName = `clip_${opts.clip.id}_${Date.now()}.mp4`;

			try {
				// Write input file
				await ffmpeg.writeFile(inputName, await fetchFile(opts.videoFile));

				// Build video filter chain
				const postProcessFilters: string[] = [];
				const complexGraphParts: string[] = [];
				let videoInputLabel = "0:v";

				// Format (crop + scale)
				// Implementation of blurred background for Vertical/Square
				if (opts.format === "vertical") {
					complexGraphParts.push(
						"[0:v]split=2[bg][fg]",
						"[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg_final]",
						"[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg_final]",
						"[bg_final][fg_final]overlay=(W-w)/2:(H-h)/2[basev]",
					);
					videoInputLabel = "[basev]";
				} else if (opts.format === "square") {
					complexGraphParts.push(
						"[0:v]split=2[bg][fg]",
						"[bg]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=20:10[bg_final]",
						"[fg]scale=1080:1080:force_original_aspect_ratio=decrease[fg_final]",
						"[bg_final][fg_final]overlay=(W-w)/2:(H-h)/2[basev]",
					);
					videoInputLabel = "[basev]";
				}

				// Color grading
				if (opts.colorGrading) {
					const { brightness, contrast, saturation } = opts.colorGrading;
					const hasEffect =
						brightness !== 0 || contrast !== 1 || saturation !== 1;
					if (hasEffect) {
						const eqFilter = `eq=brightness=${brightness.toFixed(2)}:contrast=${contrast.toFixed(2)}:saturation=${saturation.toFixed(2)}`;
						postProcessFilters.push(eqFilter);
					}
				}

				// Caption burn-in
				if (
					opts.caption &&
					opts.caption.style !== "none" &&
					opts.caption.text
				) {
					const { text, style, fontSize, color } = opts.caption;
					const safeText = text
						.replace(/\\/g, "\\\\")
						.replace(/\r?\n/g, "\\n")
						.replace(/'/g, "\\'")
						.replace(/:/g, "\\:")
						.replace(/,/g, "\\,")
						.replace(/\[/g, "\\[")
						.replace(/\]/g, "\\]")
						.replace(/%/g, "\\%");

					let drawtext = `drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=h*0.82:box=1:boxcolor=black@0.6:boxborderw=12:line_spacing=8`;
					if (style === "traditional") {
						drawtext = `drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=h-th-30:shadowx=2:shadowy=2:shadowcolor=black@0.8`;
					}
					postProcessFilters.push(drawtext);
				}

				// Silence Removal (Speech segments only)
				let afilter = "";
				if (opts.speechSegments && opts.speechSegments.length > 0) {
					const clipSpeech = opts.speechSegments
						.filter((s) => s.end > opts.clip.start && s.start < opts.clip.end)
						.map((s) => ({
							start: Math.max(s.start, opts.clip.start),
							end: Math.min(s.end, opts.clip.end),
						}));

					if (clipSpeech.length > 0) {
						const selectParts = clipSpeech
							.map(
								(s) => `between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})`,
							)
							.join("+");
						const vselect = `select='${selectParts}',setpts=N/FRAME_RATE/TB`;
						const aselect = `aselect='${selectParts}',asetpts=N/SR/TB`;
						postProcessFilters.push(vselect);
						afilter = aselect;
					}
				}

				const useSelectTrimming = !!afilter;
				const args: string[] = [];
				if (!useSelectTrimming) {
					args.push("-ss", opts.clip.start.toFixed(3));
					args.push("-to", opts.clip.end.toFixed(3));
				}
				args.push("-i", inputName);

				if (complexGraphParts.length > 0) {
					const filterChain =
						postProcessFilters.length > 0
							? postProcessFilters.join(",")
							: "null";
					complexGraphParts.push(`${videoInputLabel}${filterChain}[vout]`);
					args.push("-filter_complex", complexGraphParts.join(";"));
					args.push("-map", "[vout]", "-map", "0:a?");
				} else if (postProcessFilters.length > 0) {
					args.push("-vf", postProcessFilters.join(","));
				}

				if (afilter) {
					args.push("-af", afilter);
				}

				args.push(
					"-c:v",
					"libx264",
					"-c:a",
					"aac",
					"-preset",
					"ultrafast",
					"-crf",
					"23",
					"-y",
					outputName,
				);

				console.log("FFmpeg executing:", args.join(" "));
				await ffmpeg.exec(args);

				const data = await ffmpeg.readFile(outputName);
				const uint8 = data as Uint8Array;
				const buffer = uint8.buffer.slice(
					uint8.byteOffset,
					uint8.byteOffset + uint8.byteLength,
				) as ArrayBuffer;

				const clipTitle = opts.clip.title
					.replace(/[^a-zA-Z0-9]/g, "_")
					.slice(0, 30);
				const filename = `clip_${clipTitle}.mp4`;

				// Salvar no servidor (public/uploads)
				try {
					const blob = new Blob([buffer], { type: "video/mp4" });
					const formData = new FormData();
					formData.append(
						"file",
						new File([blob], filename, { type: "video/mp4" }),
					);
					await fetch("/api/upload", { method: "POST", body: formData });
				} catch (uploadErr) {
					console.warn("Falha ao salvar no servidor:", uploadErr);
				}

				// Download local
				downloadBuffer({ buffer, filename, mimeType: "video/mp4" });

				setStatus("done");
			} catch (e) {
				console.error("FFmpeg export error:", e);
				setStatus("error");
				setError("Erro ao processar vídeo. Tente novamente.");
			} finally {
				try {
					await ffmpeg.deleteFile(inputName);
				} catch {}
				try {
					await ffmpeg.deleteFile(outputName);
				} catch {}
				setTimeout(() => setStatus("idle"), 3000);
			}
		},
		[load, setProgress],
	);

	const exportThumbnail = useCallback(
		async (videoFile: File, atSecond: number, clipTitle: string) => {
			return new Promise<void>((resolve, reject) => {
				const video = document.createElement("video");
				const url = URL.createObjectURL(videoFile);
				video.src = url;
				video.muted = true;
				video.preload = "metadata";
				video.addEventListener("loadedmetadata", () => {
					video.currentTime = atSecond;
				});
				video.addEventListener("seeked", () => {
					const canvas = document.createElement("canvas");
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					const ctx = canvas.getContext("2d");
					if (!ctx) {
						reject(new Error("Canvas context unavailable"));
						return;
					}
					ctx.drawImage(video, 0, 0);
					canvas.toBlob((blob) => {
						URL.revokeObjectURL(url);
						if (!blob) {
							reject(new Error("Canvas blob failed"));
							return;
						}
						const a = document.createElement("a");
						a.href = URL.createObjectURL(blob);
						a.download = `thumb_${clipTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.png`;
						a.click();
						URL.revokeObjectURL(a.href);
						resolve();
					}, "image/png");
				});
				video.load();
			});
		},
		[],
	);

	return { exportClip, exportThumbnail, status, error, isLoading, progress };
}
