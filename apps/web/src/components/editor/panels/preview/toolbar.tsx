"use client";

import { useEditor } from "@/hooks/use-editor";
import { formatTimeCode } from "@/lib/time";
import { invokeAction } from "@/lib/actions";
import { EditableTimecode } from "@/components/editable-timecode";
import { Button } from "@/components/ui/button";
import { useTimelineStore } from "@/stores/timeline-store";
import {
	FullScreenIcon,
	PauseIcon,
	PlayIcon,
	RecordIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OcSocialIcon } from "@opencut/ui/icons";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function PreviewToolbar({
	isFullscreen,
	onToggleFullscreen,
}: {
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}) {
	const editor = useEditor();
	const isPlaying = editor.playback.getIsPlaying();
	const currentTime = editor.playback.getCurrentTime();
	const totalDuration = editor.timeline.getTotalDuration();
	const fps = editor.project.getActive().settings.fps;
	const autoKeyframingEnabled = useTimelineStore((s) => s.autoKeyframingEnabled);
	const toggleAutoKeyframing = useTimelineStore((s) => s.toggleAutoKeyframing);

	return (
		<TooltipProvider delayDuration={400}>
			<div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 pt-5 px-5">
				<div className="flex items-center">
					<Tooltip>
						<TooltipTrigger asChild>
							<div>
								<EditableTimecode
									time={currentTime}
									duration={totalDuration}
									format="HH:MM:SS:FF"
									fps={fps}
									onTimeChange={({ time }) => editor.playback.seek({ time })}
									className="text-center"
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							Tempo atual — clique para digitar um tempo específico
						</TooltipContent>
					</Tooltip>
					<span className="text-muted-foreground px-2 font-mono text-xs">/</span>
					<span className="text-muted-foreground font-mono text-xs">
						{formatTimeCode({
							timeInSeconds: totalDuration,
							format: "HH:MM:SS:FF",
							fps,
						})}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="text"
								size="icon"
								className={cn(
									"transition-colors",
									autoKeyframingEnabled ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 hover:text-red-600" : "text-muted-foreground"
								)}
								onClick={() => toggleAutoKeyframing()}
							>
								<HugeiconsIcon icon={RecordIcon} className={autoKeyframingEnabled ? "fill-current" : ""} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top">
							{autoKeyframingEnabled ? "Desativar Auto-Keyframing" : "Ativar Auto-Keyframing (Modo Gravação)"}
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="text"
								size="icon"
								onClick={() => invokeAction("toggle-play")}
							>
								<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top">
							{isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
						</TooltipContent>
					</Tooltip>
				</div>

				<div className="justify-self-end flex items-center gap-2.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="secondary"
								size="sm"
								className="[&_svg]:size-auto px-1 h-7"
								onClick={onToggleFullscreen}
							>
								<OcSocialIcon size={20} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">TikTok / Formato vertical</TooltipContent>
					</Tooltip>
					<Separator orientation="vertical" className="h-4" />
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="text"
								onClick={onToggleFullscreen}
							>
								<HugeiconsIcon icon={FullScreenIcon} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}
