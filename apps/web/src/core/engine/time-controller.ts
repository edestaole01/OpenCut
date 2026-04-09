/**
 * OpenCut Precision Engine (OPE) - TimeController
 * The heart of the player. Synchronizes all tracks to a master clock.
 */

type TimeListener = (time: number) => void;

export class TimeController {
	private masterTime = 0;
	private lastUpdate = 0;
	private isPlaying = false;
	private rafId: number | null = null;
	private listeners: Set<TimeListener> = new Set();
	private videoElement: HTMLVideoElement | null = null;

	constructor() {
		this.tick = this.tick.bind(this);
	}

	/**
	 * Binds a video element to act as the primary time slave.
	 * If the video drifts, the MasterClock follows the video.
	 */
	public bindVideo(video: HTMLVideoElement): void {
		this.videoElement = video;
	}

	public subscribe(listener: TimeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	public play(): void {
		if (this.isPlaying) return;
		this.isPlaying = true;
		this.lastUpdate = performance.now();
		this.rafId = requestAnimationFrame(this.tick);
		this.videoElement?.play().catch(() => {});
	}

	public pause(): void {
		this.isPlaying = false;
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.videoElement?.pause();
	}

	public seek(time: number): void {
		this.masterTime = time;
		if (this.videoElement) {
			this.videoElement.currentTime = time;
		}
		this.notify();
	}

	public getTime(): number {
		return this.masterTime;
	}

	private tick(now: number): void {
		if (!this.isPlaying) return;

		if (this.videoElement) {
			// SYNC HEARTBEAT: The video is the truth for actual playback
			// but we use the MasterClock for high-frequency metadata dispatch
			const videoTime = this.videoElement.currentTime;
			const drift = Math.abs(videoTime - this.masterTime);

			// Tight sync: If drift > 20ms, force sync master clock to video
			// This is essential for frame-accurate caption rendering.
			if (drift > 0.02) {
				this.masterTime = videoTime;
			} else {
				// Linear interpolation based on delta
				const delta = (now - this.lastUpdate) / 1000;
				this.masterTime += delta;
			}
		} else {
			const delta = (now - this.lastUpdate) / 1000;
			this.masterTime += delta;
		}

		this.lastUpdate = now;
		this.notify();
		this.rafId = requestAnimationFrame(this.tick);
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener(this.masterTime);
		}
	}
}
