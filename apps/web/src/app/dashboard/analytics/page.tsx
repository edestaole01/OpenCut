"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart2, TrendingUp, Eye, Clock, Zap, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Clips gerados", value: "0", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { label: "Vídeos analisados", value: "0", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Visualizações estimadas", value: "—", icon: Eye, color: "text-green-500", bg: "bg-green-500/10" },
  { label: "Tempo economizado", value: "0h", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance e insights dos seus conteúdos</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score viral */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Previsão de Performance</CardTitle>
          </div>
          <CardDescription>Score viral dos seus clips baseado em IA — Fase 6</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <BarChart2 className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium">Nenhum dado ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Analise vídeos no AI Studio para ver métricas de performance e score viral
              </p>
            </div>
            <Link href="/dashboard/ai-studio">
              <Button className="gap-2">
                <Zap className="w-4 h-4" />
                Ir para AI Studio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Funcionalidades futuras */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Em desenvolvimento (Fase 6)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Previsão de performance por score viral",
              "Melhores horários para postar",
              "Relatório semanal automático por email",
              "Controle de gastos de IA (tokens consumidos)",
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
