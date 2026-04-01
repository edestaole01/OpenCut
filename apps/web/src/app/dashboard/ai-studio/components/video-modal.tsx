"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import { X, Play, Volume2, VolumeX, Clock, Star, FileText, Sparkles, Film, Wrench, Activity } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.js";
import { cn } from "@/lib/utils";
import {
	scoreColor,
	tagColor,
	isDemoTranscript,
	getClipTranscriptSegments,
	formatTime,
} from "../utils/transcript-utils";
import { TimeController } from "@/core/engine/time-controller";
import { CanvasRenderer } from "@/core/engine/canvas-renderer";
import { WordMap } from "@/core/engine/word-map";
import type { WordMetadata } from "@/core/engine/types";

interface Clip {
	id: string;
	title: string;
	start: number;
	end: number;
	score: number;
	tag: string;
	caption: string;
}

interface VideoModalProps {
	clip: Clip;
	videoUrl: string;
	transcript?: string | WordMetadata[];
	onClose: () => void;
	onCalibrate?: (clip: Clip, actualTime: number) => void;
}

export function VideoModal({
	clip,
	videoUrl,
	transcript,
	onClose,
	onCalibrate,
}: VideoModalProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const waveformRef = useRef<HTMLDivElement>(null);
	const wavesurferRef = useRef<WaveSurfer | null>(null);
	const engineRef = useRef<{
		timer: TimeController;
		renderer: CanvasRenderer | null;
		wordMap: WordMap | null;
	}>({
		timer: new TimeController(),
		renderer: null,
		wordMap: null,
	});

	const [muted, setMuted] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(clip.start);
	const [captionOffset, setCaptionOffset] = useState(0);

	const hasRealTranscript = Boolean(
		transcript && (Array.isArray(transcript) || !isDemoTranscript(transcript)),
	);

	// Initialize WordMap if transcript is available
	const transcriptSegments = useMemo(() => {
		if (!hasRealTranscript || !transcript) return [];

		// If we already have word-level metadata (from refinement), use it directly!
		if (Array.isArray(transcript)) {
			engineRef.current.wordMap = new WordMap(transcript);
			return transcript.map(w => ({
				start: w.start,
				end: w.end,
				text: w.text
			}));
		}

		// Fallback: parse string transcript and map to WordMetadata for the engine
		const segments = getClipTranscriptSegments(transcript as string, clip.start, clip.end);
		const words: WordMetadata[] = segments.map((s, i) => ({
			id: `w-${i}`,
			text: s.text,
			start: s.start,
			end: s.end,
			confidence: 1,
			isPunctuation: false,
		}));
		engineRef.current.wordMap = new WordMap(words);
		
		return segments;
	}, [transcript, clip.start, clip.end, hasRealTranscript]);

	useEffect(() => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		const waveformContainer = waveformRef.current;
		if (!video || !canvas || !waveformContainer) return;

		// Initialize OPE Engine
		const { timer } = engineRef.current;
		timer.bindVideo(video);

		// Initialize WaveSurfer for visual sync
		if (!wavesurferRef.current) {
			wavesurferRef.current = WaveSurfer.create({
				container: waveformContainer,
				waveColor: "#6366f1", // Indigo
				progressColor: "#22d3ee", // Cyan
				cursorColor: "#ffffff",
				barWidth: 2,
				barRadius: 3,
				height: 50,
				normalize: true,
				interact: true, // User can click on waveform to seek
				media: video, // Links waveform to the video element
				plugins: [
					TimelinePlugin.create({
						height: 20,
						insertPosition: "afterend",
						style: {
							color: "#94a3b8",
							fontSize: "9px",
							fontFamily: "monospace",
						},
					}),
				],
			});
		}

		if (!engineRef.current.renderer) {
			engineRef.current.renderer = new CanvasRenderer(canvas, {
				fontSize: 42,
				strokeWidth: 6,
			});
		}

		const onLoaded = () => {
			video.currentTime = clip.start;
			engineRef.current.renderer?.resize(video.clientWidth, video.clientHeight);
		};
		
		if (video.readyState >= 1) onLoaded();
		else video.addEventListener("loadedmetadata", onLoaded, { once: true });

		// MASTER CLOCK LISTENER
		const unsubscribe = timer.subscribe((time) => {
			setCurrentTime(time);
			
			// Dynamic Caption Rendering via Canvas (OPE)
			const activeWord = engineRef.current.wordMap?.getActiveWord(time + captionOffset);
			if (activeWord) {
				engineRef.current.renderer?.render([activeWord], time + captionOffset, activeWord.id);
			} else {
				engineRef.current.renderer?.clear();
			}

			// Smooth loop logic
			if (time >= clip.end + 0.3) {
				timer.seek(clip.start);
			}
		});

		return () => {
			unsubscribe();
			timer.pause();
			wavesurferRef.current?.destroy();
			wavesurferRef.current = null;
		};
	}, [clip.start, clip.end, captionOffset]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const toggleMute = () => {
		const v = videoRef.current;
		if (!v) return;
		v.muted = !v.muted;
		setMuted(v.muted);
	};

	const handlePlay = () => {
		if (playing) {
			engineRef.current.timer.pause();
			setPlaying(false);
		} else {
			setMuted(false);
			setPlaying(true);
			engineRef.current.timer.play();
		}
	};

	const handleSeek = (time: number) => {
		engineRef.current.timer.seek(time);
	};

	const adjustCaptionOffset = (delta: number) => {
		setCaptionOffset((prev) => Math.round((prev + delta) * 10) / 10);
	};

	const handleCalibrate = () => {
		if (!onCalibrate) return;
		onCalibrate(clip, currentTime);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes modal
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
			role="presentation"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="relative w-full max-w-5xl bg-card rounded-2xl overflow-hidden shadow-2xl flex flex-col"
				style={{ maxHeight: "92vh" }}
			>
				<button
					type="button"
					className="absolute top-3 right-3 z-30 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
					onClick={onClose}
				>
					<X className="w-4 h-4" />
				</button>

				<div className="flex flex-col overflow-auto">
					<div className="w-full bg-black">
						<div className="relative group/player flex flex-col items-center justify-center bg-black">
							<video
								ref={videoRef}
								src={videoUrl}
								className="w-full max-h-[42vh] object-contain shadow-2xl"
								playsInline
								onPlay={() => setPlaying(true)}
								onPause={() => setPlaying(false)}
							>
								<track kind="captions" label="Legendas indisponíveis" />
							</video>

							{/* WAVEFORM VISUALIZER - THE NEW SOURCE OF TRUTH */}
							<div className="w-full bg-slate-900/90 backdrop-blur-md border-t border-white/10 p-3 px-6 min-h-[130px] flex flex-col justify-center">
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
										<span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Monitor de Sincronia de Áudio</span>
									</div>
									<div className="text-[10px] font-mono text-white/40">
										{formatTime(currentTime)} / {formatTime(clip.end)}
									</div>
								</div>
								
								<div 
									ref={waveformRef} 
									className="w-full opacity-90 hover:opacity-100 transition-opacity cursor-pointer h-[50px] mb-3" 
								/>

								{/* TRANSPORT CONTROLES (PLAY, PAUSE, SEEK) */}
								<div className="flex items-center justify-center gap-6">
									<button
										type="button"
										className="text-white/60 hover:text-white transition-colors"
										onClick={() => handleSeek(Math.max(clip.start, currentTime - 5))}
										title="Voltar 5 segundos"
									>
										<span className="text-xs font-bold">-5s</span>
									</button>

									<button
										type="button"
										className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
										onClick={handlePlay}
									>
										{playing ? (
											<div className="flex gap-1">
												<div className="w-1.5 h-4 bg-current rounded-full" />
												<div className="w-1.5 h-4 bg-current rounded-full" />
											</div>
										) : (
											<Play className="w-5 h-5 fill-current ml-1" />
										)}
									</button>

									<button
										type="button"
										className="text-white/60 hover:text-white transition-colors"
										onClick={() => handleSeek(Math.min(clip.end, currentTime + 5))}
										title="Avançar 5 segundos"
									>
										<span className="text-xs font-bold">+5s</span>
									</button>
								</div>
							</div>

							{/* OPE PRECISION CANVAS LAYER */}
							<canvas
								ref={canvasRef}
								className="absolute inset-0 pointer-events-none w-full h-full"
								style={{ zIndex: 10, bottom: "80px" }} // Adjusted to sit above waveform
							/>

							{!playing && (
								<button
									type="button"
									className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors group z-20"
									onClick={handlePlay}
								>
									<div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
										<Play className="w-9 h-9 text-black ml-1.5" />
									</div>
								</button>
							)}

							<button
								type="button"
								className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white rounded-full p-2.5 transition-colors shadow-lg z-20"
								onClick={toggleMute}
							>
								{muted ? (
									<VolumeX className="w-5 h-5" />
								) : (
									<Volume2 className="w-5 h-5" />
								)}
							</button>
							<div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-2 z-20">
								<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
								{formatTime(currentTime)} / {formatTime(clip.end)}
							</div>

							{/* CONTROLES DE AJUSTE DE SINCRONIA (NUDGE) */}
							<div className={cn(
								"absolute top-4 left-4 flex flex-col gap-2 transition-opacity duration-300 z-20",
								captionOffset === 0 ? "opacity-0 group-hover/player:opacity-100" : "opacity-100"
							)}>
								<div className="bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-xl flex items-center gap-2">
									<p className="text-[9px] font-bold text-white/70 uppercase tracking-tighter ml-1">
										Sincronia Legendas
									</p>
									<div className="flex items-center gap-1">
										<button
											type="button"
											className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors"
											onClick={() => adjustCaptionOffset(-0.1)}
											title="Adiantar legendas (-0.1s)"
										>
											-0.1s
										</button>
										<span className={cn(
											"text-[10px] font-mono w-10 text-center font-bold",
											captionOffset === 0 ? "text-white/40" : captionOffset > 0 ? "text-green-400" : "text-red-400"
										)}>
											{captionOffset > 0 ? "+" : ""}{captionOffset.toFixed(1)}s
										</span>
										<button
											type="button"
											className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors"
											onClick={() => adjustCaptionOffset(0.1)}
											title="Atrasar legendas (+0.1s)"
										>
											+0.1s
										</button>
									</div>
								</div>

								{onCalibrate && (
									<button
										type="button"
										className="bg-primary/80 hover:bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-xl border border-white/10 shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
										onClick={handleCalibrate}
										title="Usa o tempo atual do vídeo para calibrar todos os clipes"
									>
										<Wrench className="w-3 h-3" />
										FIXAR SINCRONIA GLOBAL
									</button>
								)}
							</div>
						</div>
					</div>

					<div className="flex flex-col md:flex-row border-t bg-card">
						<div className="md:w-[45%] p-6 space-y-4 border-b md:border-b-0 md:border-r">
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 flex-wrap">
									<span
										className={cn(
											"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
											tagColor[clip.tag] ||
												"bg-secondary text-secondary-foreground",
										)}
									>
										{clip.tag}
									</span>
									<span
										className={cn(
											"text-xs font-bold flex items-center gap-1",
											scoreColor(clip.score),
										)}
									>
										<Star className="w-3.5 h-3.5 fill-current" />
										{clip.score} PTS
									</span>
								</div>
								<h3 className="font-bold text-xl leading-tight">{clip.title}</h3>
							</div>

							<div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
								<span className="flex items-center gap-1.5">
									<Clock className="w-4 h-4" />
									<span className="font-mono">
										{formatTime(clip.start)} {"->"} {formatTime(clip.end)}
									</span>
								</span>
								<div className="w-px h-3 bg-border" />
								<span className="font-semibold text-foreground">
									{formatTime(clip.end - clip.start)}
								</span>
							</div>

							<div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 relative overflow-hidden group">
								<div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
								<p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
									<Sparkles className="w-3 h-3" />
									Caption Sugerido
								</p>
								<p className="text-sm leading-relaxed text-foreground/90 font-medium italic">
									"{clip.caption}"
								</p>
							</div>
						</div>

						<div className="md:w-[55%] flex flex-col bg-muted/10">
							<div className="px-6 py-4 bg-muted/20 border-b flex items-center justify-between">
								<div className="flex items-center gap-2.5">
									<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
										<FileText className="w-4 h-4 text-primary" />
									</div>
									<div>
										<h4 className="font-bold text-sm">Transcrição</h4>
										<p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
											Sincronizada com o player
										</p>
									</div>
								</div>
							</div>

							<div className="p-6 overflow-y-auto max-h-[300px] custom-scrollbar">
								{hasRealTranscript ? (
									<div className="space-y-4">
										{transcriptSegments.map((seg, idx) => {
											const adjustedStart = seg.start + captionOffset;
											const adjustedEnd = seg.end + captionOffset;
											const isCurrent =
												currentTime >= adjustedStart && currentTime < adjustedEnd;

											return (
												// biome-ignore lint/a11y/useButtonElement: interactive segment
												<div
													key={`${seg.start}-${idx}`}
													className={cn(
														"group flex gap-4 cursor-pointer transition-all duration-300 p-2 -mx-2 rounded-xl border border-transparent",
														isCurrent
															? "bg-primary/5 border-primary/20 shadow-sm scale-[1.02]"
															: "hover:bg-muted/50",
													)}
													onClick={() => handleSeek(seg.start)}
												>
													<span
														className={cn(
															"text-[10px] font-mono mt-1 flex-shrink-0 w-10 text-right font-bold transition-colors",
															isCurrent
																? "text-primary"
																: "text-muted-foreground group-hover:text-foreground",
														)}
													>
														[{formatTime(seg.start)}]
													</span>
													<p
														className={cn(
															"text-sm leading-relaxed transition-all",
															isCurrent
																? "text-foreground font-semibold"
																: "text-muted-foreground group-hover:text-foreground",
														)}
													>
														{seg.text}
													</p>
												</div>
											);
										})}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-40 text-center gap-3">
										<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
											<FileText className="w-6 h-6 text-muted-foreground/40" />
										</div>
										<p className="text-sm text-muted-foreground font-medium">
											Transcrição não disponível para este trecho.
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
