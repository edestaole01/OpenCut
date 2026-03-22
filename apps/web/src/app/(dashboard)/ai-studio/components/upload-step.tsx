"use client";
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Video, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadStepProps {
  onVideoSelected: (file: File) => void;
}

export function UploadStep({ onVideoSelected }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
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
                  <HardDrive className="w-3 h-3" />
                  {formatSize(selectedFile.size)}
                </p>
              </div>
              <Button onClick={() => onVideoSelected(selectedFile)}>
                Analisar com IA →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modo Rapido */}
      {selectedFile && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            A IA vai analisar o vídeo, sugerir clips, gerar legendas e criar captions para redes sociais automaticamente
          </p>
        </div>
      )}
    </div>
  );
}
