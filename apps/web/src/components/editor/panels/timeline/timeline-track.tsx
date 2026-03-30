"use client";

import { memo, useEffect, useState } from "react";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { TimelineElement } from "./timeline-element";
import type { TimelineTrack } from "@/types/timeline";
import type { TimelineElement as TimelineElementType } from "@/types/timeline";
import type { SnapPoint } from "@/lib/timeline/snap-utils";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEdgeAutoScroll } from "@/hooks/timeline/use-edge-auto-scroll";
import type { ElementDragState } from "@/types/timeline";
import { useEditor } from "@/hooks/use-editor";

// Render buffer beyond the visible area to prevent flickering during scroll
const VIRTUAL_BUFFER_PX = 400;

interface TimelineTrackContentProps {
	track: TimelineTrack;
	zoomLevel: number;
	dragState: ElementDragState;
	rulerScrollRef: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
	lastMouseXRef: React.RefObject<number>;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
	onResizeStateChange?: (params: { isResizing: boolean }) => void;
	onElementMouseDown: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onElementClick: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onTrackMouseDown?: (event: React.MouseEvent) => void;
	onTrackClick?: (event: React.MouseEvent) => void;
	shouldIgnoreClick?: () => boolean;
	targetElementId?: string | null;
}

export const TimelineTrackContent = memo(function TimelineTrackContent({
	track,
	zoomLevel,
	dragState,
	rulerScrollRef,
	tracksScrollRef,
	lastMouseXRef,
	onSnapPointChange,
	onResizeStateChange,
	onElementMouseDown,
	onElementClick,
	onTrackMouseDown,
	onTrackClick,
	shouldIgnoreClick,
	targetElementId = null,
}: TimelineTrackContentProps) {
	const _editor = useEditor();
	const { isElementSelected } = useElementSelection();

	// Subscribe only to "timeline" — no re-renders from media/selection/renderer
	const duration = useEditor(
		(e) => e.timeline.getTotalDuration(),
		["timeline"],
	);

	// Track scroll position to virtualize off-screen elements
	const [scrollLeft, setScrollLeft] = useState(0);
	useEffect(() => {
		const el = tracksScrollRef.current;
		if (!el) return;
		const onScroll = () => setScrollLeft(el.scrollLeft);
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [tracksScrollRef]);

	useEdgeAutoScroll({
		isActive: dragState.isDragging,
		getMouseClientX: () => lastMouseXRef.current ?? 0,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth: duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel,
	});

	return (
		/* biome-ignore lint/a11y/noStaticElementInteractions: track container needs click handling */
		<div
			className="size-full cursor-default"
			role="presentation"
			onClick={(event) => {
				if (shouldIgnoreClick?.()) return;
				onTrackClick?.(event);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					if (shouldIgnoreClick?.()) return;
					onTrackClick?.(event as unknown as React.MouseEvent);
				}
			}}
			onMouseDown={(event) => {
				onTrackMouseDown?.(event);
			}}
		>
			<div className="relative h-full min-w-full">
				{track.elements.length === 0 ? (
					<div className="text-muted-foreground border-muted/30 flex size-full items-center justify-center rounded-sm border-2 border-dashed text-xs" />
				) : (
					track.elements.map((element) => {
						const pxPerSec = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
						const elementLeft = element.startTime * pxPerSec;
						const elementWidth = element.duration * pxPerSec;
						const viewportWidth = tracksScrollRef.current?.clientWidth ?? 0;
						const isBeingDragged =
							dragState.elementId === element.id && dragState.isDragging;
						const visibleStart = scrollLeft - VIRTUAL_BUFFER_PX;
						const visibleEnd = scrollLeft + viewportWidth + VIRTUAL_BUFFER_PX;
						if (
							!isBeingDragged &&
							(elementLeft + elementWidth < visibleStart ||
								elementLeft > visibleEnd)
						) {
							return null;
						}

						const isSelected = isElementSelected({
							trackId: track.id,
							elementId: element.id,
						});

						return (
							<TimelineElement
								key={element.id}
								element={element}
								track={track}
								zoomLevel={zoomLevel}
								isSelected={isSelected}
								onSnapPointChange={onSnapPointChange}
								onResizeStateChange={onResizeStateChange}
								onElementMouseDown={(event, element) =>
									onElementMouseDown({ event, element, track })
								}
								onElementClick={(event, element) =>
									onElementClick({ event, element, track })
								}
								dragState={dragState}
								isDropTarget={element.id === targetElementId}
							/>
						);
					})
				)}
			</div>
		</div>
	);
});
TimelineTrackContent.displayName = "TimelineTrackContent";
