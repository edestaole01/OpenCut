/**
 * OpenCut Precision Engine (OPE) - Type Definitions
 * Phase 1: Word-Level Data Architecture
 */

export interface WordMetadata {
	/** Unique identifier for this specific occurrence of a word */
	id: string;
	/** The actual text spoken */
	text: string;
	/** Start time in seconds with millisecond precision */
	start: number;
	/** End time in seconds with millisecond precision */
	end: number;
	/** Confidence score from the AI (0 to 1) */
	confidence: number;
	/** ID of the speaker if diarization is available */
	speakerId?: string;
	/** Whether this word is actually punctuation */
	isPunctuation: boolean;
	/** Contextual signature (neighboring words) to prevent context mismatch */
	signature?: {
		before: string[];
		after: string[];
	};
}

export interface EngineClip {
	id: string;
	title: string;
	caption: string;
	/** Reference to the first word object of the clip */
	startWordId: string;
	/** Reference to the last word object of the clip */
	endWordId: string;
	/** Absolute fallback times in case word mapping fails */
	fallbackRange: {
		start: number;
		end: number;
	};
	score: number;
	tag: string;
}

export interface TimelineTrack {
	id: string;
	type: "video" | "audio" | "captions" | "overlays";
	/** Ordered list of word metadata or media segments */
	elements: WordMetadata[] | any[];
	/** Global offset for this track in seconds */
	offset: number;
}

export interface EngineProjectState {
	version: "2.0";
	/** The master clock time of the current playback */
	currentTime: number;
	/** Full word-level transcript indexed by ID */
	wordMap: Record<string, WordMetadata>;
	/** List of tracks in the project */
	tracks: TimelineTrack[];
	/** List of viral clips identified */
	clips: EngineClip[];
}
