"use client";
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Video, HardDrive, Zap, Loader2, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoogleDrivePicker } from "../hooks/use-google-drive-picker";

interface UploadStepProps {
  onVideoSelected: (file: File, quickMode?: boolean) => void;
}

export function UploadStep({ onVideoSelected }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDriveInput, setShowDriveInput] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveProgress, setDriveProgress] = useState(0);
  const { pickFile, status: driveStatus, progress: drivePickProgress, error: drivePickError } = useGoogleDrivePicker();

  const isDriveWorking = (["loading", "picking", "downloading"] as string[]).includes(driveStatus);
  const isDriveDone = driveStatus === "done";
  const driveStatusLabel: Record<string, string> = {
    loading: "Autenticando com Google...",
    picking: "Aguardando seleção...",
    downloading: `Baixando... ${drivePickProgress}%`,
    done: "Importado com sucesso!",
  };

  const handleGoogleDriveOAuth = async () => {
    const file = await pickFile();
    if (file) setSelectedFile(file);
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGoogleDriveImport = async () => {
    if (!driveUrl.trim()) return;
    setDriveLoading(true);
    setDriveError(null);
    setDriveProgress(0);

    try {
      const apiUrl = `/api/google-drive?url=${encodeURIComponent(driveUrl.trim())}`;

      // Usa fetch com leitura progressiva para mostrar progresso
      const res = await fetch(apiUrl);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status} ao baixar arquivo.`);
      }

      const contentType = res.headers.get("content-type") || "video/mp4";

      // Checa se não retornou HTML (confirmação do Drive)
      if (contentType.includes("text/html") || contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Arquivo requer confirmação. Baixe diretamente do Drive.");
      }

      // Lê com progresso
      const contentLength = res.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = res.body?.getReader();

      if (!reader) throw new Error("Não foi possível ler o arquivo.");

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) setDriveProgress(Math.round((received / total) * 100));
      }

      // Monta o File
      const blob = new Blob(chunks, { type: contentType });
      const disposition = res.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = nameMatch
        ? nameMatch[1].replace(/['"]/g, "").trim()
        : "video_drive.mp4";

      const file = new File([blob], filename, { type: contentType });
      setSelectedFile(file);
      setShowDriveInput(false);
      setDriveUrl("");
    } catch (err: any) {
      setDriveError(err.message || "Erro ao importar do Google Drive.");
    } finally {
      setDriveLoading(false);
      setDriveProgress(0);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-12">
          <label htmlFor="video-upload" className="cursor-pointer">
            <div className="text-center space-y-4">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-colors",
                isDragging ? "bg-primary/20" : "bg-muted"
              )}>
                <Upload className={cn("w-8 h-8", isDragging ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-lg font-semibold">Arraste seu vídeo aqui</p>
                <p className="text-muted-foreground text-sm mt-1">ou clique para selecionar</p>
              </div>
              <p className="text-xs text-muted-foreground">MP4, MOV, AVI, MKV • Máximo 2GB</p>
            </div>
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </label>
        </CardContent>
      </Card>

      {/* Importar de URL */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">ou importe de</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        {/* OAuth — acessa qualquer arquivo da conta */}
        <Button
          variant="outline"
          className={cn(
            "w-full gap-2 h-12 relative",
            isDriveDone && "border-green-500 bg-green-500/5 text-green-600",
            isDriveWorking && "border-primary bg-primary/5"
          )}
          onClick={handleGoogleDriveOAuth}
          disabled={isDriveWorking}
        >
          {isDriveWorking ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isDriveDone ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <title>Google Drive</title>
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
              <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.55A9 9 0 000 53.05h27.5z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.2z" fill="#EA4335"/>
              <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D"/>
              <path d="M59.8 53.05H27.5L13.75 76.85c1.35.8 2.9 1.15 4.5 1.15h50.8c1.6 0 3.15-.4 4.5-1.15z" fill="#2684FC"/>
              <path d="M73.4 26.5l-12.8-22.1C59.8 3 58.65 1.95 57.3 1.15L43.55 25 59.7 53.05H87.2c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00"/>
            </svg>
          )}
          <span className="flex-1 text-left">
            {isDriveWorking
              ? (driveStatusLabel[driveStatus] || "Processando...")
              : isDriveDone
              ? "Importado com sucesso!"
              : "Importar do Google Drive (login com conta)"}
          </span>
        </Button>

        {/* Progresso de download OAuth */}
        {driveStatus === "downloading" && drivePickProgress > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${drivePickProgress}%` }} />
            </div>
          </div>
        )}

        {/* Erro OAuth */}
        {driveStatus === "error" && drivePickError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{drivePickError}</span>
          </div>
        )}

        {/* Fallback: link público */}
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 text-center hover:text-foreground transition-colors"
          onClick={() => { setShowDriveInput(v => !v); setDriveError(null); }}
        >
          {showDriveInput ? "▲ Fechar" : "ou cole um link público do Drive"}
        </button>
      </div>

      {/* Google Drive input expandido */}
      {showDriveInput && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Link de compartilhamento do Google Drive</p>
              <button type="button" onClick={() => { setShowDriveInput(false); setDriveError(null); }}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="https://drive.google.com/file/d/..."
                value={driveUrl}
                onChange={e => { setDriveUrl(e.target.value); setDriveError(null); }}
                onKeyDown={e => e.key === "Enter" && handleGoogleDriveImport()}
                className="text-sm"
                disabled={driveLoading}
              />
              <Button
                onClick={handleGoogleDriveImport}
                disabled={!driveUrl.trim() || driveLoading}
                className="gap-2 flex-shrink-0"
              >
                {driveLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{driveProgress > 0 ? `${driveProgress}%` : "..."}</>
                  : "Importar"
                }
              </Button>
            </div>

            {driveLoading && driveProgress > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${driveProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">Baixando do Google Drive... {driveProgress}%</p>
              </div>
            )}

            {driveError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{driveError}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              ⚠️ O arquivo deve estar com acesso <strong>"Qualquer pessoa com o link"</strong> no Google Drive.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Arquivo selecionado */}
      {selectedFile && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <HardDrive className="w-3 h-3" />{formatSize(selectedFile.size)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onVideoSelected(selectedFile, true)}
              >
                <Zap className="w-4 h-4" />
                Modo Rápido
              </Button>
              <Button className="flex-1 gap-2" onClick={() => onVideoSelected(selectedFile, false)}>
                Analisar com IA →
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2 text-center">
              <span className="font-medium">Modo Rápido:</span> 1 clique, análise automática •{" "}
              <span className="font-medium">Analisar:</span> revisão manual dos passos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
