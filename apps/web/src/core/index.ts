import { PlaybackManager } from "./managers/playback-manager";
import { TimelineManager } from "./managers/timeline-manager";
import { ScenesManager } from "./managers/scenes-manager";
import { ProjectManager } from "./managers/project-manager";
import { MediaManager } from "./managers/media-manager";
import { RendererManager } from "./managers/renderer-manager";
import { CommandManager } from "./managers/commands";
import { SaveManager } from "./managers/save-manager";
import { AudioManager } from "./managers/audio-manager";
import { SelectionManager } from "./managers/selection-manager";
import { registerDefaultEffects } from "@/lib/effects";
import { EditorEventBus } from "./events";

export class EditorCore {
	private static instance: EditorCore | null = null;

	public readonly events: EditorEventBus;
	public readonly command: CommandManager;
	public readonly playback: PlaybackManager;
	public readonly timeline: TimelineManager;
	public readonly scenes: ScenesManager;
	public readonly project: ProjectManager;
	public readonly media: MediaManager;
	public readonly renderer: RendererManager;
	public readonly save: SaveManager;
	public readonly audio: AudioManager;
	public readonly selection: SelectionManager;

	private constructor() {
		registerDefaultEffects();
		this.events = new EditorEventBus();
		this.command = new CommandManager();
		this.playback = new PlaybackManager(this);
		this.timeline = new TimelineManager(this);
		this.scenes = new ScenesManager(this);
		this.project = new ProjectManager(this);
		this.media = new MediaManager(this);
		this.renderer = new RendererManager(this);
		this.save = new SaveManager(this);
		this.audio = new AudioManager(this);
		this.selection = new SelectionManager(this);
		this.save.start();
	}

	public async initProject(projectId: string): Promise<void> {
		try {
			// Sequence of boot:
			// 1. Pause save manager during boot
			this.save.pause();
			
			// 2. Load the project data (ProjectManager)
			// This will eventually emit PROJECT_LOADED
			await this.project.loadProject({ id: projectId });
			
			// 3. Resume save manager
			this.save.resume();
			
			console.log(`[EditorCore] Project ${projectId} initialized successfully.`);
		} catch (error) {
			console.error(`[EditorCore] Failed to initialize project ${projectId}:`, error);
			this.save.resume();
			throw error;
		}
	}

	static getInstance(): EditorCore {
		if (!EditorCore.instance) {
			EditorCore.instance = new EditorCore();
		}
		return EditorCore.instance;
	}

	static reset(): void {
		EditorCore.instance = null;
	}
}
