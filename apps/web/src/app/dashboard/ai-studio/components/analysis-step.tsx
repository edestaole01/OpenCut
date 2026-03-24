"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, ArrowLeft, Brain, Sparkles, Wand2, Film, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisStepProps {
  videoFile: File;
  onAnalysisComplete: (result: any) => void;
  onBack: () => void;
  autoStart?: boolean;
}

const AI_TIPS = [
  "Sabia que os primeiros 3 segundos de um vídeo decidem se o usuário vai continuar assistindo?",
  "Vídeos verticais têm 4x mais engajamento no Instagram e TikTok do que vídeos horizontais.",
  "Legendas coloridas aumentam o tempo de retenção em até 40% em vídeos curtos.",
  "Ganchos que começam com uma pergunta costumam ter mais comentários.",
  "A IA está analisando os picos de áudio e mudanças de cena para encontrar os cortes perfeitos.",
  "O tom de voz e a velocidade da fala influenciam diretamente na percepção de autoridade.",
];

const STATUS_MESSAGES = [
  { label: "Enviando vídeo para a nuvem segura...", icon: Film },
  { label: "IA assistindo e processando os frames...", icon: Brain },
  { label: "Transcrevendo falas e identificando palavras-chave...", icon: MessageSquare },
  { label: "Detectando momentos de alto impacto emocional...", icon: Zap },
  { label: "Cruzando dados com padrões de viralidade...", icon: Sparkles },
  { label: "Finalizando os melhores clips para você...", icon: Wand2 },
];

export function AnalysisStep({ videoFile, onAnalysisComplete, onBack, autoStart = false }: AnalysisStepProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const analysisStarted = useRef(false);
  const getMockResult = useCallback(() => ({
    clips: [
      { id: "1", title: "IntroduÃ§Ã£o impactante", start: 0, end: 18, score: 88, tag: "Gancho", caption: "Descubra como transformar sua empresa com IA! ðŸš€" },
      { id: "2", title: "Ponto principal do conteÃºdo", start: 45, end: 165, score: 84, tag: "Tutorial", caption: "Os 7 passos para lucrar com inteligÃªncia artificial ðŸ’¡" },
      { id: "3", title: "Momento de conexÃ£o", start: 180, end: 218, score: 78, tag: "Story", caption: "A histÃ³ria que mudou tudo para nossos clientes ðŸŽ¯" },
      { id: "4", title: "Dica prÃ¡tica", start: 230, end: 277, score: 71, tag: "Dica", caption: "Essa dica simples pode dobrar seus resultados âš¡" },
      { id: "5", title: "Call to action", start: 290, end: 320, score: 65, tag: "CTA", caption: "NÃ£o perca essa oportunidade Ãºnica! Clique agora ðŸ‘‡" },
    ],
    transcript: "âš ï¸ Modo demonstraÃ§Ã£o â€” a anÃ¡lise falhou ou foi simulada.\n\n[00:00] OlÃ¡ pessoal, hoje vou mostrar como usar IA...\n[00:15] O primeiro passo Ã© abrir o dashboard...\n[00:45] E o resultado foi incrÃ­vel, a empresa cresceu 3x...",
  }), []);

  // Carrossel de dicas e status
  useEffect(() => {
    if (!isAnalyzing) return;

    const tipInterval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % AI_TIPS.length);
    }, 6000);

    const statusInterval = setInterval(() => {
      setCurrentStatusIndex(prev => (prev < STATUS_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 8000);

    // Progresso artificial que desacelera conforme chega perto de 100
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + 1.5;
        if (prev < 70) return prev + 0.8;
        if (prev < 95) return prev + 0.2;
        return prev;
      });
    }, 400);

    return () => {
      clearInterval(tipInterval);
      clearInterval(statusInterval);
      clearInterval(progressInterval);
    };
  }, [isAnalyzing]);

  const startAnalysis = useCallback(async () => {
    if (analysisStarted.current) return;
    analysisStarted.current = true;
    
    setIsAnalyzing(true);
    setProgress(5);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);

      const response = await fetch("/api/ai-studio/analyze", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setProgress(100);
        setTimeout(() => onAnalysisComplete(result), 800);
      } else {
        throw new Error("API error");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      // Fallback para mock se a API falhar (modo dev/demonstração)
      setProgress(100);
      setTimeout(() => onAnalysisComplete(getMockResult()), 800);
    }
  }, [videoFile, onAnalysisComplete, getMockResult]);

  // Auto-start para modo rápido
  useEffect(() => {
    if (autoStart) startAnalysis();
  }, [autoStart, startAnalysis]);


  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="overflow-hidden border-primary/20 shadow-xl">
        <CardContent className="p-0">
          {!isAnalyzing ? (
            <div className="p-10 text-center space-y-8 bg-gradient-to-b from-primary/5 to-background">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Brain className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-2 shadow-lg animate-bounce">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">{videoFile.name}</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Tudo pronto! Nossa inteligência artificial vai identificar os momentos mais virais, 
                  gerar legendas criativas e transcrever cada palavra.
                </p>
              </div>

              <div className="flex gap-4 justify-center items-center">
                <Button variant="outline" onClick={onBack} className="h-12 px-6">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={startAnalysis} size="lg" className="h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20">
                  Começar Análise <Wand2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-10 space-y-10">
              {/* Status Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Processando com IA
                </div>
                <h2 className="text-2xl font-bold transition-all duration-500">
                  {STATUS_MESSAGES[currentStatusIndex].label}
                </h2>
                <p className="text-muted-foreground text-sm">Por favor, não feche esta aba.</p>
              </div>

              {/* Progress & Visual Scanning */}
              <div className="space-y-6 relative">
                {/* Visual Scanning Effect */}
                <div className="absolute -top-4 -left-4 -right-4 h-1 bg-primary/30 blur-sm animate-[scan_2s_ease-in-out_infinite] z-10" />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-primary flex items-center gap-2">
                      {(() => {
                        const Icon = STATUS_MESSAGES[currentStatusIndex].icon;
                        return <Icon className="w-4 h-4" />;
                      })()}
                      Etapa {currentStatusIndex + 1} de {STATUS_MESSAGES.length}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-3 rounded-full shadow-inner" />
                </div>
              </div>

              {/* Tips Carousel */}
              <div className="bg-muted/40 rounded-2xl p-6 border border-border/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 fill-current" /> Dica de Especialista
                </h4>
                <p className="text-sm font-medium leading-relaxed italic text-foreground/80 animate-in fade-in slide-in-from-bottom-2 duration-500" key={currentTipIndex}>
                  &ldquo;{AI_TIPS[currentTipIndex]}&rdquo;
                </p>
              </div>

              {/* Steps Checklist (Horizontal/Compact) */}
              <div className="flex justify-between items-center px-2">
                {STATUS_MESSAGES.map((stepInfo, index) => (
                  <div key={stepInfo.label} className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full transition-all duration-500",
                      index < currentStatusIndex ? "bg-primary" : 
                      index === currentStatusIndex ? "bg-primary animate-ping" : "bg-muted-foreground/30"
                    )} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {isAnalyzing && (
        <div className="flex justify-center gap-8 text-muted-foreground opacity-50">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> Proteção de Dados
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> IA de Alta Performance
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> Qualidade 4K Suportada
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

