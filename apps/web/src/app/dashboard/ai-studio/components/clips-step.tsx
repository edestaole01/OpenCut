"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Share2, Clock, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Clip {
  id: string;
  title: string;
  start: number;
  end: number;
  score: number;
  tag: string;
  caption: string;
}

interface ClipsStepProps {
  clips: Clip[];
  onBack: () => void;
  onPublish: () => void;
}

const scoreColor = (score: number) => {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export function ClipsStep({ clips: initialClips, onBack, onPublish }: ClipsStepProps) {
  const [clips, setClips] = useState(initialClips);
  const [selectedClips, setSelectedClips] = useState<string[]>(initialClips.map(c => c.id));

  const toggleClip = (id: string) => {
    setSelectedClips(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setSelectedClips(prev => prev.filter(c => c !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{clips.length} clips encontrados</h2>
          <p className="text-muted-foreground text-sm">{selectedClips.length} selecionados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={onPublish} disabled={selectedClips.length === 0}>
            <Share2 className="w-4 h-4 mr-2" />
            Publicar selecionados
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => {
          const isSelected = selectedClips.includes(clip.id);
          return (
            <Card
              key={clip.id}
              className={cn(
                "cursor-pointer transition-all relative",
                isSelected ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/50"
              )}
              onClick={() => toggleClip(clip.id)}
            >
              {/* Remove button */}
              <button
                className="absolute top-2 right-2 z-10 w-6 h-6 bg-background/80 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}
              >
                <X className="w-3 h-3" />
              </button>

              <CardContent className="p-4 space-y-3">
                {/* Thumbnail placeholder */}
                <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-4xl">&#x1F3AC;</span>
                </div>

                {/* Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star className={cn("w-4 h-4", scoreColor(clip.score))} />
                    <span className={cn("font-bold text-lg", scoreColor(clip.score))}>
                      {clip.score}
                    </span>
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{clip.tag}</Badge>
                </div>

                {/* Title */}
                <p className="font-medium text-sm leading-tight">{clip.title}</p>

                {/* Duration */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatTime(clip.start)} — {formatTime(clip.end)}
                  <span className="ml-auto">{formatTime(clip.end - clip.start)}</span>
                </div>

                {/* Caption preview */}
                <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">
                  {clip.caption}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Baixar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={(e) => { e.stopPropagation(); onPublish(); }}
                  >
                    <Share2 className="w-3 h-3 mr-1" />
                    Publicar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
