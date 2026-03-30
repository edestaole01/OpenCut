"use client";
import { useState, useEffect } from "react";
import { fetchWithCache } from "../utils/history-cache";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	History,
	Video,
	ArrowRight,
	Loader2,
	Calendar,
	FileVideo,
} from "lucide-react";
import { formatDate } from "@/utils/date";

interface HistoryItem {
	id: string;
	videoName: string;
	videoSize: number;
	result: HistoryResult;
	createdAt: string;
}

interface HistoryDialogProps {
	onSelect: (result: HistoryResult, videoName: string) => void;
}

type HistoryResult = {
	clips?: unknown[];
	transcript?: string;
	[key: string]: unknown;
};

export function HistoryDialog({ onSelect }: HistoryDialogProps) {
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (open) {
			setLoading(true);
			fetchWithCache<HistoryItem[]>("/api/ai-studio/history")
				.then((data) => {
					if (Array.isArray(data)) setHistory(data);
				})
				.catch(() => {})
				.finally(() => setLoading(false));
		}
	}, [open]);

	const handleSelect = (item: HistoryItem) => {
		onSelect(item.result, item.videoName);
		setOpen(false);
	};

	const formatSize = (bytes: number) => {
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" className="gap-2">
					<History className="w-4 h-4" />
					Ver Histórico
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="w-5 h-5 text-primary" />
						Histórico de Análises
					</DialogTitle>
					<DialogDescription>
						Recupere clips e transcrições de vídeos que você já analisou
						anteriormente.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto pr-1 py-2 space-y-3">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
							<Loader2 className="w-8 h-8 animate-spin text-primary" />
							<p className="text-sm">Buscando suas análises...</p>
						</div>
					) : history.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-muted-foreground">
							<FileVideo className="w-10 h-10 opacity-20" />
							<div>
								<p className="font-medium">Nenhuma análise encontrada</p>
								<p className="text-xs">
									Vídeos analisados no AI Studio aparecerão aqui.
								</p>
							</div>
						</div>
					) : (
						history.map((item) => (
							<Card
								key={item.id}
								className="hover:border-primary/50 transition-colors cursor-pointer group"
								onClick={() => handleSelect(item)}
							>
								<CardContent className="p-4 flex items-center gap-4">
									<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
										<Video className="w-6 h-6 text-primary" />
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="font-semibold text-sm truncate">
											{item.videoName}
										</h4>
										<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<Calendar className="w-3 h-3" />
												{formatDate({ date: new Date(item.createdAt) })}
											</span>
											<span>•</span>
											<span>{item.result.clips?.length || 0} clips</span>
											<span>•</span>
											<span>{formatSize(item.videoSize)}</span>
										</div>
									</div>
									<ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
								</CardContent>
							</Card>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
