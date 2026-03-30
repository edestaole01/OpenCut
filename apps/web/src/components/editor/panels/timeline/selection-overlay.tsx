"use client";

import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	timelineTimeToPixels,
	getCumulativeHeightBefore,
} from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import {
	ScissorIcon,
	Delete02Icon,
	Copy01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invokeAction } from "@/lib/actions";
import { cn } from "@/utils/ui";
import { useEffect, useState } from "react";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

export function SelectionOverlay({
	zoomLevel,
	tracksScrollRef,
}: {
	zoomLevel: number;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
	const editor = useEditor();
	// tracksScrollRef currently unused but kept for API compatibility
	void tracksScrollRef;
	const { selectedElements } = useElementSelection();
	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null,
	);
	const tracks = editor.timeline.getTracks();

	useEffect(() => {
		if (selectedElements.length === 0) {
			setPosition(null);
			return;
		}

		// Use the last selected element to position the overlay
		const lastSelection = selectedElements[selectedElements.length - 1];
		const track = tracks.find((t) => t.id === lastSelection.trackId);
		const element = track?.elements.find(
			(e) => e.id === lastSelection.elementId,
		);

		if (!track || !element) {
			setPosition(null);
			return;
		}

		const trackIndex = tracks.indexOf(track);
		const x = timelineTimeToPixels({ time: element.startTime, zoomLevel });
		const y =
			getCumulativeHeightBefore({ tracks, trackIndex }) +
			TIMELINE_CONSTANTS.PADDING_TOP_PX;

		setPosition({ x, y });
	}, [selectedElements, tracks, zoomLevel]);

	if (!position || selectedElements.length === 0) return null;

	const handleAction = (action: string) => {
		invokeAction(action as Parameters<typeof invokeAction>[0]);
	};

	return (
		<div
			className="pointer-events-none absolute z-50 flex -translate-y-full items-center gap-1 pb-2 transition-all duration-200"
			style={{
				left: `${position.x}px`,
				top: `${position.y}px`,
			}}
		>
			<div className="pointer-events-auto flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-lg backdrop-blur-sm">
				<ToolbarButton
					icon={ScissorIcon}
					onClick={() => handleAction("split")}
					tooltip="Dividir (S)"
				/>
				<ToolbarButton
					icon={Copy01Icon}
					onClick={() => handleAction("duplicate-selected")}
					tooltip="Duplicar (Ctrl+D)"
				/>
				<div className="mx-1 h-4 w-px bg-border" />
				<ToolbarButton
					icon={Delete02Icon}
					onClick={() => handleAction("delete-selected")}
					variant="destructive"
					tooltip="Excluir (Del)"
				/>
			</div>
		</div>
	);
}

function ToolbarButton({
	icon,
	onClick,
	variant = "ghost",
	tooltip,
}: {
	icon: typeof Delete02Icon;
	onClick: () => void;
	variant?: "ghost" | "destructive";
	tooltip: string;
}) {
	return (
		<Button
			variant={variant}
			size="icon"
			className={cn(
				"h-7 w-7 rounded-sm",
				variant === "destructive"
					? "text-destructive hover:bg-destructive/10"
					: "text-muted-foreground hover:text-foreground",
			)}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			title={tooltip}
		>
			<HugeiconsIcon icon={icon} className="size-4" />
		</Button>
	);
}
