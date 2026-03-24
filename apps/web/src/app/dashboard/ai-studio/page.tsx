"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { UploadStep } from "./components/upload-step";
import { AnalysisStep } from "./components/analysis-step";
import { ClipsStep } from "./components/clips-step";
import { cn } from "@/lib/utils";
import {
  Upload, Brain, Scissors, Share2,ArrowRight, Calendar, Clock, Film, Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface HistoryItem {
  id: string;
  videoName: string;
  videoSize: number;
  result: any;
  createdAt: string;
}

const steps = [
  { id: 1, label: "Upload",   icon: Upload  },
  { id: 2, label: "Análise",  icon: Brain   },
  { id: 3, label: "Clips",    icon: Scissors},
  { id: 4, label: "Publicar", icon: Share2  },
];

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateBrUtc(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function AIStudioPage() {
  const [currentStep, setCurrentStep]     = useState(1);
  const [videoFile, setVideoFile]         = useState<File | null>(null);
  const [videoUrl,  setVideoUrl]          = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [history, setHistory]             = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  // Clip pendente de edição (aguardando re-upload do vídeo)
  const [pendingHistoryItem, setPendingHistoryItem] = useState<HistoryItem | null>(null);
  const reuploadRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    fetch("/api/ai-studio/history")
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setHistory(data); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /** Usuário clicou em um item do histórico → vai direto para o step 3 */
  const handleHistorySelect = (item: HistoryItem) => {
    setAnalysisResult(item.result);
    setVideoFile(null);   // sem arquivo — vídeo original não está disponível
    setVideoUrl(null);
    setCurrentStep(3);
  };

  /** ClipsStep pede re-upload quando tenta editar sem vídeo */
  const _handleRequestReupload = (item: HistoryItem) => {
    setPendingHistoryItem(item);
    reuploadRef.current?.click();
  };

  /** Usuário selecionou o arquivo de re-upload */
  const handleReuploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingHistoryItem) return;
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setPendingHistoryItem(null);
    toast.success("Vídeo carregado! Agora clique em Editar novamente.");
    // Reseta o input para permitir selecionar o mesmo arquivo depois
    e.target.value = "";
  };

  const handleVideoSelected = (file: File, _quickMode = false) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setCurrentStep(2);
  };

  return (
    <div className="space-y-8">
      {/* Hidden re-upload input */}
      <input
        ref={reuploadRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/mkv,video/*"
        className="hidden"
        onChange={handleReuploadFile}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AI Studio</h1>
        <p className="text-muted-foreground mt-1">
          Gere clips e captions automaticamente com inteligência artificial
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                currentStep === step.id
                  ? "bg-primary border-primary text-primary-foreground"
                  : currentStep > step.id
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}>
                <step.icon className="w-4 h-4" />
              </div>
              <span className={cn(
                "text-xs font-medium",
                currentStep >= step.id ? "text-primary" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 mb-4",
                currentStep > step.id ? "bg-primary/50" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div>
        {currentStep === 1 && (
          <div className={cn(
            "grid gap-6",
            history.length > 0 ? "lg:grid-cols-[1fr_360px]" : ""
          )}>
            {/* Upload */}
            <div>
              <UploadStep onVideoSelected={handleVideoSelected} />
            </div>

            {/* Histórico — só aparece se houver itens */}
            {(historyLoading || history.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Análises anteriores
                  </h2>
                  <span className="text-xs text-muted-foreground">{history.length} vídeo{history.length !== 1 ? "s" : ""}</span>
                </div>

                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                    {history.map(item => (
                      <Card
                        key={item.id}
                        className="hover:border-primary/60 transition-colors cursor-pointer group"
                        onClick={() => handleHistorySelect(item)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          {/* Ícone */}
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <Film className="w-5 h-5 text-primary" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate leading-tight">{item.videoName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateBrUtc(item.createdAt)}
                              </span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {item.result?.clips?.length ?? 0} clips
                              </Badge>
                              {item.videoSize > 0 && (
                                <span className="text-[10px] text-muted-foreground">{formatSize(item.videoSize)}</span>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* CTA novo vídeo */}
                <Button
                  variant="outline"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                >
                  <Plus className="w-4 h-4" />
                  Analisar novo vídeo
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && videoFile && (
          <AnalysisStep
            videoFile={videoFile}
            onAnalysisComplete={(result) => {
              setAnalysisResult(result);
              setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && analysisResult && (
          <ClipsStep
            clips={analysisResult.clips}
            videoFile={videoFile}
            videoUrl={videoUrl || ""}
            transcript={analysisResult.transcript}
            onBack={() => setCurrentStep(2)}
            onPublish={() => setCurrentStep(4)}
            onRequestVideoReupload={
              !videoFile
                ? (clip) => {
                    // Guarda o item de history para depois do re-upload
                    setPendingHistoryItem({ id: "", videoName: clip?.title ?? "video", videoSize: 0, result: analysisResult, createdAt: "" });
                    reuploadRef.current?.click();
                  }
                : undefined
            }
          />
        )}

        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto text-center space-y-4 py-12">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <Share2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Pronto para publicar!</h2>
            <p className="text-muted-foreground">
              Integração com redes sociais em desenvolvimento. Em breve você poderá publicar diretamente no Instagram, LinkedIn, TikTok e YouTube.
            </p>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => setCurrentStep(3)}
            >
              ← Voltar aos clips
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
