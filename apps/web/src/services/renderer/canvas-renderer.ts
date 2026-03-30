import type { BaseNode } from "./nodes/base-node";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: number;
};

export class CanvasRenderer {
	canvas: OffscreenCanvas | HTMLCanvasElement;
	context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
	width: number;
	height: number;
	fps: number;

	constructor({ width, height, fps }: CanvasRendererParams) {
		this.width = width;
		this.height = height;
		this.fps = fps;

		const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

		try {
			this.canvas = new OffscreenCanvas(width * dpr, height * dpr);
		} catch {
			this.canvas = document.createElement("canvas");
			this.canvas.width = width * dpr;
			this.canvas.height = height * dpr;
		}

		const context = this.canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}

		this.context = context as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;

		this.context.scale(dpr, dpr);
	}

	setSize({ width, height }: { width: number; height: number }) {
		if (this.width === width && this.height === height) return;

		this.width = width;
		this.height = height;
		const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

		if (this.canvas instanceof OffscreenCanvas) {
			this.canvas.width = width * dpr;
			this.canvas.height = height * dpr;
		} else {
			this.canvas.width = width * dpr;
			this.canvas.height = height * dpr;
		}

		if (this.context) {
			this.context.scale(dpr, dpr);
		}
	}

	private clear() {
		this.context.fillStyle = "black";
		this.context.fillRect(0, 0, this.width, this.height);
	}

	async render({ node, time }: { node: BaseNode; time: number }) {
		if (
			this.context instanceof CanvasRenderingContext2D ||
			this.context instanceof OffscreenCanvasRenderingContext2D
		) {
			this.clear();
			await node.render({ renderer: this, time });
		}
	}

	private targetCtx: CanvasRenderingContext2D | null = null;
	private lastTargetCanvas: HTMLCanvasElement | null = null;

	async renderToCanvas({
		node,
		time,
		targetCanvas,
	}: {
		node: BaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
	}) {
		await this.render({ node, time });

		if (this.lastTargetCanvas !== targetCanvas) {
			this.targetCtx = targetCanvas.getContext("2d");
			this.lastTargetCanvas = targetCanvas;
		}

		if (!this.targetCtx) {
			throw new Error("Failed to get target canvas context");
		}

		this.targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
		this.targetCtx.drawImage(
			this.canvas,
			0,
			0,
			targetCanvas.width,
			targetCanvas.height,
		);
	}
}
