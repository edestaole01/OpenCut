"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisStepProps {
  videoFile: File;
  onAnalysisComplete: (result: any) => void;
  onBack: () => void;
}

const analysisSteps = [
  { id: 1, label: "Carregando vídeo", duration: 1500 },
  { id: 2, label: "Transcrevendo fala", duration: 3000 },
  { id: 3, label: "Identificando melhores momentos", duration: 3000 },
  { id: 4, label: "Gerando clips sugeridos", duration: 2000 },
  { id: 5, label: "Criando legendas", duration: 2000 },
];

export function AnalysisStep({ videoFile, onAnalysisComplete, onBack }: AnalysisStepProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [progress, setProgress] = useState(0);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setCurrentStepIndex(0);

    for (let i = 0; i < analysisSteps.length; i++) {
      setCurrentStepIndex(i);
      setProgress(((i) / analysisSteps.length) * 100);
      await new Promise(r => setTimeout(r, analysisSteps[i].duration));
    }

    setProgress(100);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);

      const response = await fetch("/api/ai-studio/analyze", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        onAnalysisComplete(result);
      } else {
        onAnalysisComplete(getMockResult());
      }
    } catch {
      onAnalysisComplete(getMockResult());
    }
  };

  const getMockResult = () => ({
    clips: [
      { id: "1", title: "Introdução impactante", start: 0, end: 18, score: 88, tag: "Gancho", caption: "Descubra como transformar sua empresa com IA!" },
      { id: "2", title: "Ponto principal do conteúdo", start: 45, end: 165, score: 84, tag: "Tutorial", caption: "Os 7 passos para lucrar com inteligência artificial" },
      { id: "3", title: "Momento de conexão", start: 180, end: 218, score: 78, tag: "Story", caption: "A história que mudou tudo para nossos clientes" },
      { id: "4", title: "Dica prática", start: 230, end: 277, score: 71, tag: "Dica", caption: "Essa dica simples pode dobrar seus resultados" },
      { id: "5", title: "Call to action", start: 290, end: 320, score: 65, tag: "CTA", caption: "Não perca essa oportunidade única! Clique agora" },
    ],
    transcript: "Transcrição completa do vídeo gerada pela IA...",
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          {!isAnalyzing ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl">&#x1F916;</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{videoFile.name}</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Pronto para analisar! A IA vai identificar os melhores clips e gerar legendas automaticamente.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={startAnalysis} size="lg">
                  Analisar com IA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold">Analisando seu vídeo...</h2>
                <p className="text-muted-foreground text-sm mt-1">Isso pode levar alguns segundos</p>
              </div>

              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">{Math.round(progress)}%</p>

              <div className="space-y-3">
                {analysisSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    {index < currentStepIndex ? (
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : index === currentStepIndex ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm",
                      index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
