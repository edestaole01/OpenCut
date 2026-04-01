import EventEmitter from "eventemitter3";
import type { TProject } from "@/types/project";
import type { TScene } from "@/types/timeline";

export type EditorEvents = {
	PROJECT_LOADED: (project: TProject) => void;
	PROJECT_SAVED: (project: TProject) => void;
	SCENE_CHANGED: (scene: TScene) => void;
	TIMELINE_CHANGED: () => void;
	ASSETS_LOADED: () => void;
	PLAYBACK_STARTED: () => void;
	PLAYBACK_STOPPED: () => void;
};

export class EditorEventBus extends EventEmitter<EditorEvents> {}
