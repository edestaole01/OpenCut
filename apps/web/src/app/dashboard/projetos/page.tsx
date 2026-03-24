"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditor } from "@/hooks/use-editor";
import { formatDate } from "@/utils/date";
import { formatTimeCode } from "@/lib/time";
import { toast } from "sonner";
import {
  Video, Plus, Zap, Clock, Calendar, MoreHorizontal, Trash2, Copy, Edit3
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TProjectMetadata } from "@/types/project";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";

function formatDuration(duration?: number) {
  if (!duration) return null;
  return formatTimeCode({ timeInSeconds: duration, format: duration >= 3600 ? "HH:MM:SS" : "MM:SS" });
}

export default function ProjetosPage() {
  const editor = useEditor();
  const router = useRouter();
  const isLoading = editor.project.getIsLoading();
  const isInitialized = editor.project.getIsInitialized();
  const projects = editor.project.getSavedProjects();

  useEffect(() => {
    if (!editor.project.getIsInitialized()) {
      editor.project.loadAllProjects();
    }
  }, [editor.project]);

  const handleNewProject = async () => {
    try {
      const projectId = await editor.project.createNewProject({ name: "Novo projeto" });
      router.push(`/editor/${projectId}`);
    } catch {
      toast.error("Erro ao criar projeto");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await editor.project.deleteProjects({ ids: [id] });
      toast.success(`"${name}" excluído`);
    } catch {
      toast.error("Erro ao excluir projeto");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await editor.project.duplicateProjects({ ids: [id] });
      toast.success("Projeto duplicado!");
    } catch {
      toast.error("Erro ao duplicar projeto");
    }
  };

  return (
    <div className="space-y-6">
      <MigrationDialog />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projetos</h1>
          <p className="text-muted-foreground mt-1">
            Seus projetos de edição de vídeo
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/ai-studio">
            <Button variant="outline" className="gap-2">
              <Zap className="w-4 h-4" />
              Criar com IA
            </Button>
          </Link>
          <Button className="gap-2" onClick={handleNewProject}>
            <Plus className="w-4 h-4" />
            Novo projeto
          </Button>
        </div>
      </div>

      {isLoading || !isInitialized ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_value, index) => `skeleton-${index + 1}`).map((skeletonId) => (
            <Card key={skeletonId}>
              <CardContent className="p-4">
                <Skeleton className="aspect-video w-full rounded-lg mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onNew={handleNewProject} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => handleDelete(project.id, project.name)}
              onDuplicate={() => handleDuplicate(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
  onDuplicate,
}: {
  project: TProjectMetadata;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const duration = formatDuration(project.duration);

  return (
    <Card className="group hover:border-primary/50 transition-colors overflow-hidden">
      <CardContent className="p-0">
        {/* Thumbnail */}
        <Link href={`/editor/${project.id}`} className="block">
          <div className="relative aspect-video bg-muted">
            {project.thumbnail ? (
              <Image
                src={project.thumbnail}
                alt={project.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Video className="w-10 h-10 text-muted-foreground/30" />
              </div>
            )}
            {duration && (
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                {duration}
              </span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/80 rounded-full px-4 py-1.5 text-xs font-semibold">
                Abrir editor →
              </div>
            </div>
          </div>
        </Link>

        {/* Info */}
        <div className="p-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/editor/${project.id}`}>
              <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors">
                {project.name}
              </h3>
            </Link>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate({ date: project.createdAt })}
              </span>
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {duration}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/editor/${project.id}`} className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />Abrir editor
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} className="gap-2">
                <Copy className="w-4 h-4" />Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
        <Video className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Nenhum projeto ainda</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Crie um projeto vazio ou use o AI Studio para gerar clips automaticamente
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="gap-2" onClick={onNew}>
          <Plus className="w-4 h-4" />
          Projeto em branco
        </Button>
        <Link href="/dashboard/ai-studio">
          <Button className="gap-2">
            <Zap className="w-4 h-4" />
            Criar com AI Studio
          </Button>
        </Link>
      </div>
    </div>
  );
}
