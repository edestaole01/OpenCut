"use client";
import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Zap, Video, Share2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "Usuário";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Olá, {firstName}! 👋</h1>
        <p className="text-muted-foreground mt-1">O que vamos criar hoje?</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Enviar novo vídeo</h2>
              <p className="text-muted-foreground text-sm mt-1">
                A IA analisa e sugere os melhores clips automaticamente
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard/ai-studio">
                <Button size="lg" className="gap-2">
                  <Zap className="w-4 h-4" />
                  Modo Rápido com IA
                </Button>
              </Link>
              <Link href="/dashboard/projetos">
                <Button size="lg" variant="outline" className="gap-2">
                  <Video className="w-4 h-4" />
                  Editor Manual
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/dashboard/ai-studio">
            <CardHeader>
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <CardTitle className="text-base">AI Studio</CardTitle>
              <CardDescription>Gere clips, legendas e captions automaticamente com IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-primary">
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/dashboard/redes-sociais">
            <CardHeader>
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-2">
                <Share2 className="w-5 h-5 text-blue-500" />
              </div>
              <CardTitle className="text-base">Redes Sociais</CardTitle>
              <CardDescription>Publique e agende posts no LinkedIn e Instagram</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-primary">
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/dashboard/projetos">
            <CardHeader>
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-2">
                <Video className="w-5 h-5 text-green-500" />
              </div>
              <CardTitle className="text-base">Projetos</CardTitle>
              <CardDescription>Veja e gerencie todos os seus projetos de vídeo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-primary">
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
