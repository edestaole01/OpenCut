"use client";
import { useRef, useEffect } from "react";
import { Maximize2, Play } from "lucide-react";

interface ClipThumbnailProps {
	videoUrl: string;
	start: number;
	onClick: (e: React.MouseEvent) => void;
}

export function ClipThumbnail({
	videoUrl,
	start,
	onClick,
}: ClipThumbnailProps) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const v = videoRef.current;
		if (!v) return;
		const onLoaded = () => {
			v.currentTime = start;
		};
		if (v.readyState >= 1) onLoaded();
		else v.addEventListener("loadedmetadata", onLoaded, { once: true });
	}, [start]);

	return (
		<button
			type="button"
			className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group cursor-pointer"
			onClick={onClick}
		>
			<video
				ref={videoRef}
				src={videoUrl}
				className="w-full h-full object-cover"
				preload="metadata"
				muted
			/>
			<div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
				<div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
					<Play className="w-5 h-5 text-black ml-0.5" />
				</div>
			</div>
			<div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
				<div className="bg-black/60 rounded-md p-1">
					<Maximize2 className="w-3 h-3 text-white" />
				</div>
			</div>
		</button>
	);
}
