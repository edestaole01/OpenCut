"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { useContainerSize } from "@/hooks/use-container-size";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { getLastFrameTime } from "@/lib/time";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";
import { BookmarkNoteOverlay } from "./bookmark-note-overlay";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { usePreviewStore } from "@/stores/preview-store";
import { PreviewContextMenu } from "./context-menu";
import { PreviewToolbar } from "./toolbar";

function usePreviewSize() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	return {
		width: activeProject?.settings.canvasSize.width,
		height: activeProject?.settings.canvasSize.height,
	};
}

export function PreviewPanel() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef });

	return (
		<div
			ref={containerRef}
			className="panel bg-background relative flex size-full min-h-0 min-w-0 flex-col rounded-sm border"
		>
			<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2 pb-0">
				<PreviewCanvas
					onToggleFullscreen={toggleFullscreen}
					containerRef={containerRef}
				/>
				<RenderTreeController />
			</div>
			<PreviewToolbar
				isFullscreen={isFullscreen}
				onToggleFullscreen={toggleFullscreen}
			/>
		</div>
	);
}

const RenderTreeController = memo(function RenderTreeController() {
	const editor = useEditor();
	// Granular subscriptions — each only re-renders when its manager changes
	const tracks = useEditor((e) => e.timeline.getTracks(), ["timeline"]);
	const mediaAssets = useEditor((e) => e.media.getAssets(), ["media"]);
	const activeProject = useEditor((e) => e.project.getActive(), ["project"]);

	const { width, height } = usePreviewSize();

	// Stable string fingerprints so regular useEffect can compare primitives
	// instead of deep-comparing nested arrays on every render.
	const _tracksKey = useMemo(
		() =>
			tracks
				.map(
					(t) =>
						`${t.id}:${t.elements.map((e) => `${e.id}|${e.startTime}|${e.duration}`).join(",")}`,
				)
				.join("|"),
		[tracks],
	);
	const _mediaKey = useMemo(
		() => mediaAssets.map((a) => a.id).join(","),
		[mediaAssets],
	);
	const _backgroundKey = JSON.stringify(activeProject?.settings.background);

	const tracksRef = useRef(tracks);
	tracksRef.current = tracks;
	const mediaRef = useRef(mediaAssets);
	mediaRef.current = mediaAssets;

	useEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks: tracksRef.current,
			mediaAssets: mediaRef.current,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
			isPreview: true,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [
		width,
		height,
		editor,
		activeProject,
		_tracksKey,
		_mediaKey,
		_backgroundKey,
	]);

	return null;
});

const PreviewCanvas = memo(function PreviewCanvas({
	onToggleFullscreen,
	containerRef,
}: {
	onToggleFullscreen: () => void;
	containerRef: React.RefObject<HTMLElement | null>;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const outerContainerRef = useRef<HTMLDivElement>(null);
	const canvasBoundsRef = useRef<HTMLDivElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const lastRenderedTimeRef = useRef(0);
	const lagStateRef = useRef(false);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const containerSize = useContainerSize({ containerRef: outerContainerRef });
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const bookmarksVisible = usePreviewStore((s) => s.overlays.bookmarks);
	const [lagInfo, setLagInfo] = useState<{ isLagging: boolean; ms: number }>({
		isLagging: false,
		ms: 0,
	});

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: nativeWidth,
			height: nativeHeight,
			fps: activeProject.settings.fps,
		});
	}, [nativeWidth, nativeHeight, activeProject.settings.fps]);

	const displaySize = useMemo(() => {
		if (
			!nativeWidth ||
			!nativeHeight ||
			containerSize.width === 0 ||
			containerSize.height === 0
		) {
			return { width: nativeWidth ?? 0, height: nativeHeight ?? 0 };
		}

		const paddingBuffer = 4;
		const availableWidth = containerSize.width - paddingBuffer;
		const availableHeight = containerSize.height - paddingBuffer;

		const aspectRatio = nativeWidth / nativeHeight;
		const containerAspect = availableWidth / availableHeight;

		const displayWidth =
			containerAspect > aspectRatio
				? availableHeight * aspectRatio
				: availableWidth;
		const displayHeight =
			containerAspect > aspectRatio
				? availableHeight
				: availableWidth / aspectRatio;

		return { width: displayWidth, height: displayHeight };
	}, [nativeWidth, nativeHeight, containerSize.width, containerSize.height]);

	const renderTree = editor.renderer.getRenderTree();

	const render = useCallback(() => {
		if (canvasRef.current && renderTree && !renderingRef.current) {
			const time = editor.playback.getCurrentTime();
			const lastFrameTime = getLastFrameTime({
				duration: renderTree.duration,
				fps: renderer.fps,
			});
			const renderTime = Math.min(time, lastFrameTime);
			const frame = Math.floor(renderTime * renderer.fps);
			const lagThreshold = Math.max(0.1, 2 / renderer.fps); // at least 2 frames or 100ms
			const deltaSinceLastRender = Math.max(
				0,
				time - lastRenderedTimeRef.current,
			);
			const isLaggingNow = deltaSinceLastRender > lagThreshold;

			if (
				isLaggingNow !== lagStateRef.current ||
				(isLaggingNow &&
					Math.abs(deltaSinceLastRender * 1000 - lagInfo.ms) > 15)
			) {
				lagStateRef.current = isLaggingNow;
				setLagInfo({
					isLagging: isLaggingNow,
					ms: Math.round(deltaSinceLastRender * 1000),
				});
			}

			if (
				frame !== lastFrameRef.current ||
				renderTree !== lastSceneRef.current
			) {
				renderingRef.current = true;
				lastSceneRef.current = renderTree;
				lastFrameRef.current = frame;
				renderer
					.renderToCanvas({
						node: renderTree,
						time: renderTime,
						targetCanvas: canvasRef.current,
					})
					.then(() => {
						lastRenderedTimeRef.current = renderTime;
						renderingRef.current = false;
					});
			}
		}
	}, [renderer, renderTree, editor.playback, lagInfo.ms]);

	useRafLoop(render);

	return (
		<div
			ref={outerContainerRef}
			className="relative flex size-full items-center justify-center"
		>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						ref={canvasBoundsRef}
						className="relative"
						style={{ width: displaySize.width, height: displaySize.height }}
					>
						<canvas
							ref={canvasRef}
							width={nativeWidth}
							height={nativeHeight}
							className="block border"
							style={{
								width: displaySize.width,
								height: displaySize.height,
								background:
									activeProject.settings.background.type === "blur"
										? "transparent"
										: activeProject?.settings.background.color,
							}}
						/>
						<PreviewInteractionOverlay
							canvasRef={canvasRef}
							containerRef={canvasBoundsRef}
						/>
						{bookmarksVisible && <BookmarkNoteOverlay />}
						<LagIndicator lagInfo={lagInfo} />
					</div>
				</ContextMenuTrigger>
				<PreviewContextMenu
					onToggleFullscreen={onToggleFullscreen}
					containerRef={containerRef}
				/>
			</ContextMenu>
		</div>
	);
});

const LagIndicator = memo(function LagIndicator({
	lagInfo,
}: {
	lagInfo: { isLagging: boolean; ms: number };
}) {
	if (!lagInfo.isLagging) return null;

	return (
		<div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-semibold uppercase text-white shadow-md">
			<span className="inline-block h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
			<span>Atraso na prévia · {lagInfo.ms}ms</span>
		</div>
	);
});
