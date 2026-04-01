/**
 * OpenCut Precision Engine (OPE) - CanvasRenderer
 * High-performance caption rendering using HTML5 Canvas.
 * Supports "Hormozi-style" animations and dynamic scaling.
 */

import type { WordMetadata } from "./types";

export interface RenderOptions {
	fontSize: number;
	fontFamily: string;
	primaryColor: string;
	strokeColor: string;
	strokeWidth: number;
	shadowColor: string;
	shadowBlur: number;
	yOffset: number; // Vertical position (percentage from bottom)
}

export class CanvasRenderer {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private options: RenderOptions;

	constructor(canvas: HTMLCanvasElement, options: Partial<RenderOptions> = {}) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Could not get 2D context");
		this.ctx = ctx;

		this.options = {
			fontSize: 48,
			fontFamily: "Inter, sans-serif",
			primaryColor: "#FFD700", // Yellow
			strokeColor: "#000000",
			strokeWidth: 8,
			shadowColor: "rgba(0,0,0,0.5)",
			shadowBlur: 10,
			yOffset: 0.75, // 75% down the screen
			...options,
		};
	}

	public clear(): void {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * Renders a set of words with "Pop" effect logic
	 */
	public render(
		words: WordMetadata[],
		currentTime: number,
		activeWordId?: string,
	): void {
		this.clear();
		if (words.length === 0) return;

		const { width, height } = this.canvas;
		const centerX = width / 2;
		const centerY = height * this.options.yOffset;

		const text = words.map((w) => w.text.toUpperCase()).join(" ");
		
		this.ctx.save();
		
		// Setup font
		this.ctx.font = `black ${this.options.fontSize}px ${this.options.fontFamily}`;
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "middle";

		// Calculate "Pop" scale for the active word
		const activeWord = words.find(w => w.id === activeWordId);
		let scale = 1.0;
		if (activeWord) {
			const progress = (currentTime - activeWord.start) / (activeWord.end - activeWord.start);
			// Quick pop in effect
			scale = progress < 0.2 ? 1.0 + (0.2 - progress) * 2 : 1.0;
		}

		this.ctx.translate(centerX, centerY);
		this.ctx.scale(scale, scale);

		// Draw Stroke
		this.ctx.strokeStyle = this.options.strokeColor;
		this.ctx.lineWidth = this.options.strokeWidth;
		this.ctx.lineJoin = "round";
		this.ctx.strokeText(text, 0, 0);

		// Draw Shadow
		this.ctx.shadowColor = this.options.shadowColor;
		this.ctx.shadowBlur = this.options.shadowBlur;
		this.ctx.shadowOffsetX = 4;
		this.ctx.shadowOffsetY = 4;

		// Draw Primary Text
		this.ctx.fillStyle = this.options.primaryColor;
		this.ctx.fillText(text, 0, 0);

		this.ctx.restore();
	}

	/**
	 * Updates renderer dimensions (call this on window resize or video load)
	 */
	public resize(width: number, height: number): void {
		this.canvas.width = width;
		this.canvas.height = height;
	}
}
