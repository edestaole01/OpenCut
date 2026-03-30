"use client";
import { useRef, useState, useEffect } from "react";
import { X, Play, Volume2, VolumeX, Clock, Star, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	formatTime,
	scoreColor,
	tagColor,
	isDemoTranscript,
	extractClipTranscript,
} from "../utils/transcript-utils";

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
	transcript?: string;
	onClose: () => void;
}

export function VideoModal({
	clip,
	videoUrl,
	transcript,
	onClose,
}: VideoModalProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [muted, setMuted] = useState(false);
	const [playing, setPlaying] = useState(false);
	const hasRealTranscript = Boolean(
		transcript && !isDemoTranscript(transcript),
	);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		const onLoaded = () => {
			video.currentTime = clip.start;
			video.muted = false;
			video.volume = 1;
		};
		if (video.readyState >= 1) onLoaded();
		else video.addEventListener("loadedmetadata", onLoaded, { once: true });

		const onTime = () => {
			if (video.currentTime >= clip.end) {
				video.pause();
				video.currentTime = clip.start;
				setPlaying(false);
			}
		};
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);
		video.addEventListener("timeupdate", onTime);
		video.addEventListener("play", onPlay);
		video.addEventListener("pause", onPause);
		return () => {
			video.removeEventListener("timeupdate", onTime);
			video.removeEventListener("play", onPlay);
			video.removeEventListener("pause", onPause);
		};
	}, [clip.start, clip.end]);

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
		const v = videoRef.current;
		if (!v) return;
		if (playing) {
			v.pause();
		} else {
			v.muted = false;
			v.volume = 1;
			setMuted(false);
			v.play().catch(() => {});
		}
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
					className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
					onClick={onClose}
				>
					<X className="w-4 h-4" />
				</button>

				<div className="flex flex-col overflow-auto">
					<div className="w-full bg-black">
						<div className="relative">
							<video
								ref={videoRef}
								src={videoUrl}
								className="w-full max-h-[52vh] object-contain"
								playsInline
							>
								<track kind="captions" label="Legendas indisponíveis" />
							</video>
							{!playing && (
								<button
									type="button"
									className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors"
									onClick={handlePlay}
								>
									<div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
										<Play className="w-7 h-7 text-black ml-1" />
									</div>
								</button>
							)}
							<button
								type="button"
								className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors"
								onClick={toggleMute}
							>
								{muted ? (
									<VolumeX className="w-4 h-4" />
								) : (
									<Volume2 className="w-4 h-4" />
								)}
							</button>
							<div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
								{formatTime(clip.start)} {"->"} {formatTime(clip.end)}
							</div>
						</div>
					</div>

					<div className="flex flex-col md:flex-row border-t">
						<div className="md:w-[45%] p-4 space-y-3 border-b md:border-b-0 md:border-r">
							<div className="flex items-start justify-between gap-2">
								<h3 className="font-semibold text-base">{clip.title}</h3>
								<div className="flex items-center gap-2 flex-shrink-0">
									<span
										className={cn(
											"font-bold flex items-center gap-1",
											scoreColor(clip.score),
										)}
									>
										<Star className="w-4 h-4 fill-current" />
										{clip.score} pts
									</span>
									<span
										className={cn(
											"text-xs px-2 py-0.5 rounded-full font-medium",
											tagColor[clip.tag] ||
												"bg-secondary text-secondary-foreground",
										)}
									>
										{clip.tag}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-3 text-xs text-muted-foreground">
								<span className="flex items-center gap-1">
									<Clock className="w-3.5 h-3.5" />
									{formatTime(clip.start)} {"->"} {formatTime(clip.end)}
									<span className="font-semibold text-foreground ml-1">
										({formatTime(clip.end - clip.start)})
									</span>
								</span>
								<span className="flex items-center gap-1 text-green-600">
									{muted ? (
										<>
											<VolumeX className="w-3.5 h-3.5 text-red-500" />
											<span className="text-red-500">Mudo</span>
										</>
									) : (
										<>
											<Volume2 className="w-3.5 h-3.5" />
											Som ativado
										</>
									)}
								</span>
							</div>
							<div className="bg-muted/50 rounded-xl p-3">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
									<FileText className="w-3 h-3" />
									Caption para redes sociais
								</p>
								<p className="text-sm">{clip.caption}</p>
							</div>
						</div>

						<div className="md:w-[55%] flex flex-col">
							<div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
								<FileText className="w-4 h-4 text-primary" />
								<div>
									<h4 className="font-semibold text-sm">
										Transcrição do vídeo
									</h4>
									<p className="text-xs text-muted-foreground">
										Trecho: {formatTime(clip.start)} {"->"}{" "}
										{formatTime(clip.end)}
									</p>
								</div>
							</div>
							<div className="p-4 overflow-y-auto max-h-52">
								{hasRealTranscript ? (
									<p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
										{extractClipTranscript(
											transcript ?? "",
											clip.start,
											clip.end,
										)}
									</p>
								) : (
									<div className="flex flex-col items-center justify-center h-24 text-center gap-2">
										<FileText className="w-7 h-7 text-muted-foreground/40" />
										<p className="text-sm text-muted-foreground">
											Transcrição real não disponível.
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
