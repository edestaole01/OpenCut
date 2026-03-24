"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Calendar, Linkedin, Instagram, Youtube, Twitter, Plus, Zap } from "lucide-react";
import Link from "next/link";

const platforms = [
  { name: "LinkedIn", icon: Linkedin, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", connected: false },
  { name: "Instagram", icon: Instagram, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20", connected: false },
  { name: "YouTube", icon: Youtube, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", connected: false },
  { name: "Twitter/X", icon: Twitter, color: "text-gray-800 dark:text-gray-200", bg: "bg-gray-50 dark:bg-gray-900/20", connected: false },
];

export default function RedesSociaisPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Redes Sociais</h1>
          <p className="text-muted-foreground mt-1">Publique e agende conteúdo nas suas redes</p>
        </div>
        <Link href="/dashboard/ai-studio">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Criar conteúdo com IA
          </Button>
        </Link>
      </div>

      {/* Plataformas */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contas conectadas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {platforms.map(p => (
            <Card key={p.name} className="relative">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className={`w-12 h-12 ${p.bg} rounded-xl flex items-center justify-center`}>
                  <p.icon className={`w-6 h-6 ${p.color}`} />
                </div>
                <p className="font-medium text-sm">{p.name}</p>
                <Badge variant={p.connected ? "default" : "outline"} className="text-xs">
                  {p.connected ? "Conectado" : "Desconectado"}
                </Badge>
                <Button variant="outline" size="sm" className="w-full text-xs mt-1" disabled>
                  {p.connected ? "Gerenciar" : "Conectar (em breve)"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Calendário editorial */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Calendário Editorial</CardTitle>
          </div>
          <CardDescription>Agende e visualize seus posts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Calendar className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium">Nenhum post agendado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Conecte suas redes sociais e agende conteúdo gerado pelo AI Studio
              </p>
            </div>
            <Link href="/dashboard/ai-studio">
              <Button className="gap-2">
                <Zap className="w-4 h-4" />
                Gerar conteúdo com IA
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Biblioteca de Hashtags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Biblioteca de Hashtags e CTAs
          </CardTitle>
          <CardDescription>Em desenvolvimento — Fase 4</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["#inteligenciaartificial", "#marketingdigital", "#videocontent", "#socialmedia", "#ia", "#business"].map(tag => (
              <span key={tag} className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground cursor-default">
                {tag}
              </span>
            ))}
            <span className="px-3 py-1 border border-dashed rounded-full text-xs text-muted-foreground/50">
              + adicionar (em breve)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
