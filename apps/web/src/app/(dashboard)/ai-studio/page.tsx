"use client";
import { useState } from "react";
import { UploadStep } from "./components/upload-step";
import { AnalysisStep } from "./components/analysis-step";
import { ClipsStep } from "./components/clips-step";
import { cn } from "@/lib/utils";
import { Upload, Brain, Scissors, Share2 } from "lucide-react";

const steps = [
  { id: 1, label: "Upload", icon: Upload },
  { id: 2, label: "Análise", icon: Brain },
  { id: 3, label: "Clips", icon: Scissors },
  { id: 4, label: "Publicar", icon: Share2 },
];

export default function AIStudioPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AI Studio</h1>
        <p className="text-muted-foreground mt-1">Gere clips e captions automaticamente com inteligência artificial</p>
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
          <UploadStep
            onVideoSelected={(file) => {
              setVideoFile(file);
              setCurrentStep(2);
            }}
          />
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
            onBack={() => setCurrentStep(2)}
            onPublish={() => setCurrentStep(4)}
          />
        )}
      </div>
    </div>
  );
}
