"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Share2, Clock, Star, X,
  FileText, Play, ChevronDown, ChevronUp, Maximize2,
  Volume2, VolumeX, Search, Download, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportPanel } from "./export-panel";

import { useRouter } from "next/navigation";
import { EditorCore } from "@/core";
import { toast } from "sonner";
import { Film } from "lucide-react";

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
  videoFile: File | null;
  videoUrl?: string;
  transcript?: string;
  onBack: () => void;
  onPublish: () => void;
  onRequestVideoReupload?: (clip: Clip) => void;
}

const scoreColor = (s: number) =>
  s >= 80 ? "text-green-500" : s >= 60 ? "text-yellow-500" : "text-red-500";

const scoreBg = (s: number) =>
  s >= 80
    ? "border-green-500/40 bg-green-500/5"
    : s >= 60
    ? "border-yellow-500/40 bg-yellow-500/5"
    : "border-red-500/40 bg-red-500/5";

const tagColor: Record<string, string> = {
  Gancho: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Tutorial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Story: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Dica: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CTA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Extrai só a parte da transcrição que cobre o trecho start→end do clip.
 * Suporta timestamps no formato [MM:SS] ou [HH:MM:SS].
 */
function extractClipTranscript(
  transcript: string,
  startSec: number,
  endSec: number
): string {
  if (!transcript) return "";

  // Parse timestamps like [00:00], [01:23], [1:23:45]
  const timeRegex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

  interface Segment { time: number; rawTag: string; index: number }
  const markers: Segment[] = [];
  let m: RegExpExecArray | null;

  for (
    m = timeRegex.exec(transcript);
    m !== null;
    m = timeRegex.exec(transcript)
  ) {
    const parts = m[0].replace(/\[|\]/g, "").split(":").map(Number);
    const time = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
    markers.push({ time, rawTag: m[0], index: m.index });
  }

  if (markers.length === 0) return transcript; // sem timestamps → devolve tudo

  // Monta segmentos com texto entre timestamps
  const segments: Array<{ time: number; text: string }> = [];
  for (let i = 0; i < markers.length; i++) {
    const tagEnd = markers[i].index + markers[i].rawTag.length;
    const textEnd = i + 1 < markers.length ? markers[i + 1].index : transcript.length;
    const text = transcript.slice(tagEnd, textEnd).trim();
    if (text) segments.push({ time: markers[i].time, text });
  }

  // Filtra com margem de ±3s para não cortar frases que começam um pouco antes/depois
  const margin = 3;
  const relevant = segments.filter(
    s => s.time >= startSec - margin && s.time <= endSec + margin
  );

  if (relevant.length === 0) {
    // Nenhum timestamp exato → retorna mensagem orientativa
    return `(Trecho ${formatTime(startSec)}→${formatTime(endSec)} — sem transcrição específica para este momento)`;
  }

  return relevant
    .map(s => `[${formatTime(s.time)}] ${s.text}`)
    .join("\n");
}

const ALL_TAGS = ["Todos", "Gancho", "Tutorial", "Story", "Dica", "CTA"];

// ─── Modal expandido ──────────────────────────────────────────────────────────
function VideoModal({
  clip, videoUrl, transcript, onClose,
}: { clip: Clip; videoUrl: string; transcript?: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => { video.currentTime = clip.start; video.muted = false; video.volume = 1; };
    if (video.readyState >= 1) onLoaded();
    else video.addEventListener("loadedmetadata", onLoaded, { once: true });

    const onTime = () => {
      if (video.currentTime >= clip.end) { video.pause(); video.currentTime = clip.start; setPlaying(false); }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [clip.start, clip.end]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); }
    else { v.muted = false; v.volume = 1; setMuted(false); v.play().catch(() => {}); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-5xl bg-card rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        <button
          type="button"
          className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col overflow-auto">
          {/* Video */}
          <div className="w-full bg-black">
            <div className="relative">
              <video ref={videoRef} src={videoUrl} className="w-full max-h-[52vh] object-contain" playsInline>
                <track kind="captions" label="Legendas indisponÃ­veis" />
              </video>
              {!playing && (
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors"
                  onClick={handlePlay}
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
                    <Play className="w-7 h-7 text-black ml-1" />
                  </div>
                </button>
              )}
              <button
                type="button"
                className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors"
                onClick={toggleMute}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                {formatTime(clip.start)} → {formatTime(clip.end)}
              </div>
            </div>
          </div>

          {/* Info + Transcript */}
          <div className="flex flex-col md:flex-row border-t">
            <div className="md:w-[45%] p-4 space-y-3 border-b md:border-b-0 md:border-r">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-base">{clip.title}</h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("font-bold flex items-center gap-1", scoreColor(clip.score))}>
                    <Star className="w-4 h-4 fill-current" />{clip.score} pts
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tagColor[clip.tag] || "bg-secondary text-secondary-foreground")}>
                    {clip.tag}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />{formatTime(clip.start)} → {formatTime(clip.end)}
                  <span className="font-semibold text-foreground ml-1">({formatTime(clip.end - clip.start)})</span>
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  {muted
                    ? <><VolumeX className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Mudo</span></>
                    : <><Volume2 className="w-3.5 h-3.5" />Som ativado</>}
                </span>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />Caption para redes sociais
                </p>
                <p className="text-sm">{clip.caption}</p>
              </div>
            </div>

            {/* Transcript */}
            <div className="md:w-[55%] flex flex-col">
              <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <h4 className="font-semibold text-sm">Transcrição do vídeo</h4>
                  <p className="text-xs text-muted-foreground">Trecho: {formatTime(clip.start)} → {formatTime(clip.end)}</p>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-52">
                {transcript ? (
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {extractClipTranscript(transcript, clip.start, clip.end)}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-center gap-2">
                    <FileText className="w-7 h-7 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Transcrição não disponível.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Thumbnail no card ─────────────────────────────────────────────────────────
function ClipThumbnail({ videoUrl, start, onClick }: { videoUrl: string; start: number; onClick: (e: React.MouseEvent) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => { v.currentTime = start; };
    if (v.readyState >= 1) onLoaded();
    else v.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, [start]);

  return (
    <button
      type="button"
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group cursor-pointer"
      onClick={onClick}
    >
      <video ref={videoRef} src={videoUrl} className="w-full h-full object-cover" preload="metadata" muted />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
          <Play className="w-5 h-5 text-black ml-0.5" />
        </div>
      </div>
      <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/60 rounded-md p-1"><Maximize2 className="w-3 h-3 text-white" /></div>
      </div>
    </button>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function ClipsStep({
  clips: initialClips,
  videoFile,
  videoUrl: initialVideoUrl,
  transcript,
  onBack,
  onPublish,
  onRequestVideoReupload,
}: ClipsStepProps) {
  const router = useRouter();
  const [clips, setClips] = useState(initialClips);
  const [selectedClips, setSelectedClips] = useState<string[]>(initialClips.map(c => c.id));
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [exportClip, setExportClip] = useState<Clip | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("Todos");
  const [sortBy, setSortBy] = useState<"score" | "start">("score");

  useEffect(() => {
    if (!videoFile) {
      setVideoUrl(initialVideoUrl ?? null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile, initialVideoUrl]);

  const filtered = useMemo(() => {
    let list = [...clips];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.caption.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q)
      );
    }
    if (activeTag !== "Todos") list = list.filter(c => c.tag === activeTag);
    if (sortBy === "score") list.sort((a, b) => b.score - a.score);
    else list.sort((a, b) => a.start - b.start);
    return list;
  }, [clips, search, activeTag, sortBy]);

  const toggleClip = (id: string) =>
    setSelectedClips(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setSelectedClips(prev => prev.filter(c => c !== id));
  };

  const handleEditInTimeline = async (clip: Clip) => {
    if (!videoFile) {
      if (onRequestVideoReupload) {
        onRequestVideoReupload(clip);
        toast.info("Selecione o vídeo original para continuar editando.");
      }
      return;
    }

    const toastId = toast.loading("Preparando editor...");
    try {
      const editor = EditorCore.getInstance();
      
      // 1. Criar novo projeto (com metadados persistidos)
      const projectId = await editor.project.createNewProject({ 
        name: `Clip: ${clip.title}` 
      });

      // 2. Adicionar o vídeo como asset
      const videoUrl = URL.createObjectURL(videoFile);

      const assetId = await editor.media.addMediaAsset({
        projectId,
        asset: {
          name: videoFile.name,
          type: "video",
          file: videoFile,
          url: videoUrl,
          size: videoFile.size,
        } as any
      });

      // 3. Inserir clip na timeline
      editor.timeline.insertElement({
        placement: { mode: "auto", trackType: "video" },
        element: {
          type: "video",
          mediaId: assetId,
          name: clip.title,
          startTime: 0,
          trimStart: clip.start,
          trimEnd: 0,
          duration: clip.end - clip.start,
          transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
          opacity: 1,
        } as any
      });

      // 4. Adicionar a Legenda (Track de Texto)
      if (clip.caption) {
        editor.timeline.insertElement({
          placement: { mode: "auto", trackType: "text" },
          element: {
            type: "text",
            name: "Legenda AI",
            content: clip.caption,
            startTime: 0,
            duration: clip.end - clip.start,
            trimStart: 0,
            trimEnd: 0,
            fontSize: 48,
            fontFamily: "Inter",
            color: "#ffffff",
            textAlign: "center",
            fontWeight: "bold",
            transform: { position: { x: 0, y: 180 }, scale: 1, rotate: 0 },
            opacity: 1,
            background: { enabled: true, color: "rgba(0,0,0,0.5)", cornerRadius: 4, paddingX: 10, paddingY: 5 }
          } as any
        });
      }

      // Salvar projeto com a timeline antes de navegar
      await editor.project.saveCurrentProject();

      toast.success("Clip aberto no editor!", { id: toastId });
      router.push(`/editor/${projectId}`);
    } catch (err) {
      console.error("Erro ao abrir no editor:", err);
      toast.error("Não foi possível abrir o editor.", { id: toastId });
    }
  };

  return (
    <div className="space-y-5">
      {/* Modals */}
      {activeClip && videoUrl && (
        <VideoModal clip={activeClip} videoUrl={videoUrl} transcript={transcript} onClose={() => setActiveClip(null)} />
      )}
      {exportClip && videoFile && (
        <ExportPanel clip={exportClip} videoFile={videoFile} onClose={() => setExportClip(null)} />
      )}

      {/* Banner: análise do histórico sem vídeo */}
      {!videoFile && onRequestVideoReupload && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
          <Film className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="flex-1 text-yellow-800 dark:text-yellow-300">
            Análise carregada do histórico. Para <strong>editar no timeline</strong> ou <strong>exportar</strong>, selecione o vídeo original.
          </p>
          <button
            type="button"
            className="text-yellow-700 dark:text-yellow-400 underline text-xs shrink-0"
            onClick={() => onRequestVideoReupload(clips[0])}
          >
            Selecionar vídeo
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{clips.length} clips encontrados</h2>
          <p className="text-muted-foreground text-sm">{selectedClips.length} selecionados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
          <Button onClick={onPublish} disabled={selectedClips.length === 0}>
            <Share2 className="w-4 h-4 mr-2" />Publicar
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar clips, captions, tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortBy(s => s === "score" ? "start" : "score")}
            title={sortBy === "score" ? "Ordenar por tempo" : "Ordenar por score"}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        {/* Tag filter */}
        <div className="flex gap-2 flex-wrap">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                activeTag === tag
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              {tag}
            </button>
          ))}
          <span className="text-xs text-muted-foreground self-center ml-auto">
            {sortBy === "score" ? "↓ Maior score" : "↓ Cronológico"}
          </span>
        </div>
      </div>

      {/* Transcript collapsible */}
      {transcript && (
        <div className="border rounded-xl overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
            onClick={() => setShowTranscript(v => !v)}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Transcrição completa do vídeo
            </div>
            {showTranscript ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showTranscript && (
            <div className="p-4 text-sm text-muted-foreground leading-relaxed max-h-52 overflow-y-auto border-t whitespace-pre-wrap">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Clips grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Search className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum clip encontrado para &ldquo;{search}&rdquo;</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setActiveTag("Todos"); }}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(clip => {
            const isSelected = selectedClips.includes(clip.id);
            return (
              <Card
                key={clip.id}
                className={cn(
                  "cursor-pointer transition-all relative overflow-hidden",
                  isSelected
                    ? `border-2 ring-1 ring-primary/30 ${scoreBg(clip.score)}`
                    : "hover:shadow-md hover:border-muted-foreground/40"
                )}
                onClick={() => toggleClip(clip.id)}
              >
                {/* Remove button */}
                <button
                  type="button"
                  className="absolute top-2 right-2 z-10 w-6 h-6 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
                  onClick={e => { e.stopPropagation(); removeClip(clip.id); }}
                >
                  <X className="w-3 h-3" />
                </button>

                <CardContent className="p-0">
                  <div className="flex">
                    {/* Thumbnail */}
                    <div className="w-44 flex-shrink-0 p-3">
                      {videoUrl ? (
                        <>
                          <ClipThumbnail
                            videoUrl={videoUrl}
                            start={clip.start}
                            onClick={e => { e.stopPropagation(); setActiveClip(clip); }}
                          />
                          <p className="text-center text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                            <Maximize2 className="w-3 h-3" />Expandir
                          </p>
                        </>
                      ) : (
                        <div className="w-full aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-1">
                          <span className="text-3xl">🎬</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 pr-8 space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className={cn("flex items-center gap-1 font-bold", scoreColor(clip.score))}>
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-base">{clip.score}</span>
                          <span className="text-xs font-normal text-muted-foreground">pts</span>
                        </div>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tagColor[clip.tag] || "bg-secondary text-secondary-foreground")}>
                          {clip.tag}
                        </span>
                      </div>

                      <p className="font-semibold text-sm leading-tight">{clip.title}</p>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(clip.start)} → {formatTime(clip.end)}</span>
                        <span className="ml-auto font-semibold text-foreground">{formatTime(clip.end - clip.start)}</span>
                      </div>

                      <div className="border-t pt-2">
                        <p className="text-xs leading-relaxed line-clamp-2 text-foreground/80">{clip.caption}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <Button
                          size="sm" variant="outline"
                          className="flex-1 text-xs h-7 gap-1 min-w-[80px]"
                          onClick={e => { e.stopPropagation(); setExportClip(clip); }}
                        >
                          <Download className="w-3 h-3" />Baixar
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="flex-1 text-xs h-7 gap-1 min-w-[80px]"
                          onClick={e => { e.stopPropagation(); handleEditInTimeline(clip); }}
                        >
                          <Film className="w-3 h-3" />Editar
                        </Button>
                        <Button
                          size="sm"
                          className="w-full text-xs h-7 gap-1 mt-1"
                          onClick={e => { e.stopPropagation(); onPublish(); }}
                        >
                          <Share2 className="w-3 h-3" />Publicar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
