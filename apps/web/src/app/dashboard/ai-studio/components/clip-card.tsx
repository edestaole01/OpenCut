"use client";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Clock,
	Star,
	X,
	Film,
	Download,
	Sparkles,
	Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipThumbnail } from "./clip-thumbnail";
import {
	formatTime,
	scoreColor,
	scoreBg,
	tagColor,
} from "../utils/transcript-utils";

interface Clip {
	id: string;
	title: string;
	start: number;
	end: number;
	score: number;
	tag: string;
	caption: string;
}

interface ClipCardProps {
	clip: Clip;
	isSelected: boolean;
	isResolving: boolean;
	videoUrl: string | null;
	onToggle: (id: string) => void;
	onRemove: (id: string) => void;
	onExpand: (clip: Clip) => void;
	onExport: (clip: Clip) => void;
	onEditInTimeline: (clip: Clip) => void;
	onOpenCaptionGenerator: (clip: Clip) => void;
	onPreview?: (clip: Clip) => void;
	onNudge?: (clip: Clip, deltaSeconds: number) => void;
	onSnapToTranscript?: (clip: Clip) => void;
	onRemoveSilences?: (clip: Clip) => void;
	onRefine?: (clip: Clip) => void;
	isRefining?: boolean;
	hasRefinedTranscript?: boolean;
	onRestore?: (clip: Clip) => void;
}

export const ClipCard = memo(function ClipCard({
	clip,
	isSelected,
	isResolving,
	videoUrl,
	onToggle,
	onRemove,
	onExpand,
	onExport,
	onEditInTimeline,
	onOpenCaptionGenerator,
	onPreview,
	onNudgeStart,
	onNudgeEnd,
	onSnapToTranscript,
	onRemoveSilences,
	onRefine,
	isRefining,
	hasRefinedTranscript,
	onRestore,
}: ClipCardProps) {
	return (
		<Card
			className={cn(
				"cursor-pointer transition-all relative overflow-hidden",
				isSelected
					? `border-2 ring-1 ring-primary/30 ${scoreBg(clip.score)}`
					: "hover:shadow-md hover:border-muted-foreground/40",
			)}
			onClick={() => onToggle(clip.id)}
		>
			<button
				type="button"
				className="absolute top-2 right-2 z-10 w-6 h-6 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(clip.id);
				}}
			>
				<X className="w-3 h-3" />
			</button>

			<CardContent className="p-0">
				<div className="flex">
					<div className="w-44 flex-shrink-0 p-3">
						{videoUrl ? (
							<>
								<ClipThumbnail
									videoUrl={videoUrl}
									start={clip.start}
									onClick={(e) => {
										e.stopPropagation();
										onExpand(clip);
									}}
								/>
								<p className="text-center text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
									<Maximize2 className="w-3 h-3" />
									Expandir
								</p>
							</>
						) : (
							<div className="w-full aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-1">
								<span className="text-3xl">🎬</span>
							</div>
						)}
					</div>

					<div className="flex-1 p-3 pr-8 space-y-2 min-w-0">
						<div className="flex items-center justify-between gap-1">
							<div
								className={cn(
									"flex items-center gap-1 font-bold",
									scoreColor(clip.score),
								)}
							>
								<Star className="w-3.5 h-3.5 fill-current" />
								<span className="text-base">{clip.score}</span>
								<span className="text-xs font-normal text-muted-foreground">
									pts
								</span>
							</div>
							<span
								className={cn(
									"text-xs px-2 py-0.5 rounded-full font-medium",
									tagColor[clip.tag] ||
										"bg-secondary text-secondary-foreground",
								)}
							>
								{clip.tag}
							</span>
						</div>

						<p className="font-semibold text-sm leading-tight">{clip.title}</p>

						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Clock className="w-3 h-3" />
							<span>{`${formatTime(Number(clip.start))} -> ${formatTime(Number(clip.end))}`}</span>
							<span className="ml-auto font-semibold text-foreground">
								{formatTime(Math.max(0, Number(clip.end) - Number(clip.start)))}
							</span>
						</div>

						<div className="border-t pt-2">
							<p className="text-xs leading-relaxed line-clamp-2 text-foreground/80">
								{clip.caption}
							</p>
						</div>

						<div className="flex flex-wrap gap-1.5 pt-0.5">
							<Button
								size="sm"
								variant="outline"
								className="flex-1 text-xs h-7 gap-1 min-w-[80px]"
								disabled={isResolving}
								onClick={async (e) => {
									e.stopPropagation();
									onExport(clip);
								}}
							>
								{isResolving ? (
									<div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
								) : (
									<Download className="w-3 h-3" />
								)}
								Baixar
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="flex-1 text-xs h-7 gap-1 min-w-[80px]"
								disabled={isResolving}
								onClick={(e) => {
									e.stopPropagation();
									(onPreview ?? onExpand)(clip);
								}}
							>
								<Film className="w-3 h-3" />
								Preview
							</Button>

							<div className="w-full flex items-center gap-1.5 mb-1 bg-muted/30 p-1.5 rounded-lg border border-border/50">
								<div className="flex flex-col flex-1 gap-1">
									<p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1 text-center">InÃ­cio</p>
									<div className="flex gap-1">
										<Button
											size="sm"
											variant="outline"
											className="flex-1 text-[9px] h-6 px-0"
											onClick={(e) => { e.stopPropagation(); onNudgeStart?.(clip, -0.5); }}
											title="Adiantar inÃ­cio -0.5s"
										>
											-0.5s
										</Button>
										<Button
											size="sm"
											variant="outline"
											className="flex-1 text-[9px] h-6 px-0"
											onClick={(e) => { e.stopPropagation(); onNudgeStart?.(clip, 0.5); }}
											title="Retardar inÃ­cio +0.5s"
										>
											+0.5s
										</Button>
									</div>
								</div>
								<div className="w-px h-6 bg-border mt-3" />
								<div className="flex flex-col flex-1 gap-1">
									<p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1 text-center">Fim</p>
									<div className="flex gap-1">
										<Button
											size="sm"
											variant="outline"
											className="flex-1 text-[9px] h-6 px-0"
											onClick={(e) => { e.stopPropagation(); onNudgeEnd?.(clip, -0.5); }}
											title="Adiantar fim -0.5s"
										>
											-0.5s
										</Button>
										<Button
											size="sm"
											variant="outline"
											className="flex-1 text-[9px] h-6 px-0"
											onClick={(e) => { e.stopPropagation(); onNudgeEnd?.(clip, 0.5); }}
											title="Retardar fim +0.5s"
										>
											+0.5s
										</Button>
									</div>
								</div>
							</div>

							<Button
								size="sm"
								variant="outline"
								className="text-xs h-7 gap-1 min-w-[90px]"
								disabled={isResolving}
								onClick={(e) => {
									e.stopPropagation();
									onSnapToTranscript?.(clip);
								}}
								title="Ajustar inÃ­cio pelo timestamp da transcriÃ§Ã£o"
							>
								Ajustar start
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="text-xs h-7 gap-1 min-w-[80px]"
								disabled={isResolving}
								onClick={(e) => {
									e.stopPropagation();
									onRemoveSilences?.(clip);
								}}
								title="Remover pausas de silêncio entre as falas"
							>
								<Sparkles className="w-3 h-3 text-purple-500" />
								Jump Cut
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="text-xs h-7 gap-1 min-w-[80px]"
								disabled={isResolving}
								onClick={(e) => {
									e.stopPropagation();
									onRestore?.(clip);
								}}
								title="Restaurar tempo original"
							>
								Restaurar
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="flex-1 text-xs h-7 gap-1 min-w-[80px]"
								disabled={isResolving}
								onClick={async (e) => {
									e.stopPropagation();
									onEditInTimeline(clip);
								}}
							>
								{isResolving ? (
									<div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
								) : (
									<Film className="w-3 h-3" />
								)}
								Editar
							</Button>
							<Button
								size="sm"
								className="w-full text-xs h-7 gap-1 mt-1"
								onClick={(e) => {
									e.stopPropagation();
									onOpenCaptionGenerator(clip);
								}}
							>
								<Sparkles className="w-3 h-3" />
								Caption IA
							</Button>
							<Button
								size="sm"
								variant={hasRefinedTranscript ? "secondary" : "default"}
								className={cn(
									"w-full text-xs h-7 gap-1 mt-1",
									!hasRefinedTranscript && "bg-purple-600 hover:bg-purple-700 text-white"
								)}
								disabled={isRefining || isResolving}
								onClick={(e) => {
									e.stopPropagation();
									onRefine?.(clip);
								}}
							>
								{isRefining ? (
									<div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
								) : (
									<Sparkles className="w-3 h-3" />
								)}
								{hasRefinedTranscript ? "Legendas Refinadas" : "Refinar Legendas (HD)"}
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
});
