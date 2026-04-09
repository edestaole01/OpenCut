import type { CanvasRenderer } from "../canvas-renderer";
import { VisualNode, type VisualNodeParams } from "./visual-node";
import { videoCache } from "@/services/video-cache/service";

export interface VideoNodeParams extends VisualNodeParams {
	url: string;
	file: File;
	mediaId: string;
}

export class VideoNode extends VisualNode<VideoNodeParams> {
	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange({ time })) {
			// Pre-warm: If the playhead is close to starting this clip, fetch the first frame in advance.
			const secondsToStart = this.params.timeOffset - time;
			if (secondsToStart > 0 && secondsToStart < 0.5) {
				void videoCache.prewarmAt({
					mediaId: this.params.mediaId,
					file: this.params.file,
					time: this.params.trimStart,
				});
			}
			return;
		}

		const videoTime = this.getSourceLocalTime({ time });
		const frame = await videoCache.getFrameAt({
			mediaId: this.params.mediaId,
			file: this.params.file,
			time: videoTime,
		});

		if (frame) {
			this.renderVisual({
				renderer,
				source: frame.canvas,
				sourceWidth: frame.canvas.width,
				sourceHeight: frame.canvas.height,
				timelineTime: time,
			});
		}
	}
}
