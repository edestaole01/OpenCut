"use client";

import { useState, useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

export function useFadeVolumeInteraction({
	element,
	trackId,
	zoomLevel,
}: {
	element: any;
	trackId: string;
	zoomLevel: number;
}) {
	const editor = useEditor();
	const [isDragging, setIsDragging] = useState(false);
	const [dragType, setDragType] = useState<"fadeIn" | "fadeOut" | "volume" | null>(null);

	const handleMouseDown = useCallback((
		event: React.MouseEvent, 
		type: "fadeIn" | "fadeOut" | "volume"
	) => {
		event.stopPropagation();
		event.preventDefault();
		setIsDragging(true);
		setDragType(type);

		const startX = event.clientX;
		const startY = event.clientY;
		const initialFadeIn = element.fadeIn || 0;
		const initialFadeOut = element.fadeOut || 0;
		const initialVolume = element.volume ?? 1;

		const handleMouseMove = (e: MouseEvent) => {
			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;

			if (type === "fadeIn") {
				const deltaS = deltaX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
				const newValue = Math.max(0, Math.min(element.duration / 2, initialFadeIn + deltaS));
				editor.timeline.updateElement({
					trackId,
					elementId: element.id,
					patch: { fadeIn: newValue } as any
				});
			} else if (type === "fadeOut") {
				const deltaS = -deltaX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
				const newValue = Math.max(0, Math.min(element.duration / 2, initialFadeOut + deltaS));
				editor.timeline.updateElement({
					trackId,
					elementId: element.id,
					patch: { fadeOut: newValue } as any
				});
			} else if (type === "volume") {
				// Assume 100px height for volume range
				const deltaV = -deltaY / 100;
				const newValue = Math.max(0, Math.min(2, initialVolume + deltaV));
				editor.timeline.updateElement({
					trackId,
					elementId: element.id,
					patch: { volume: newValue }
				});
			}
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			setDragType(null);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}, [element, trackId, zoomLevel, editor.timeline]);

	return {
		isDragging,
		dragType,
		handleMouseDown,
	};
}
