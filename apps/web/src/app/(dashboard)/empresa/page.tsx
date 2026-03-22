"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Save } from "lucide-react";
import { toast } from "sonner";

const industries = [
  "Tecnologia", "Saúde", "Educação", "Finanças", "Varejo",
  "Alimentação", "Moda", "Imobiliário", "Marketing", "Consultoria",
  "Entretenimento", "Esportes", "Jurídico", "Arquitetura", "Outro"
];

const tones = [
  { value: "professional", label: "Profissional e formal" },
  { value: "friendly", label: "Amigável e descontraído" },
  { value: "inspirational", label: "Inspirador e motivador" },
  { value: "educational", label: "Educativo e informativo" },
  { value: "humorous", label: "Humorístico e divertido" },
  { value: "urgent", label: "Urgente e direto" },
];

export default function EmpresaPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    tone: "",
    targetAudience: "",
    website: "",
    description: "",
  });

  const handleSave = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Perfil da empresa salvo com sucesso!");
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Building2 className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Perfil da Empresa</h1>
          <p className="text-muted-foreground">Configure as informações da sua empresa para gerar conteúdo personalizado</p>
        </div>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo da Empresa</CardTitle>
          <CardDescription>Será usada como marca d'água nos vídeos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Enviar logo
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, máximo 2MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input
              placeholder="Ex: Tech Solutions Brasil"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Setor / Segmento</Label>
            <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Site / Link</Label>
            <Input
              placeholder="https://suaempresa.com.br"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição da empresa</Label>
            <Textarea
              placeholder="Descreva brevemente o que sua empresa faz..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tom de voz */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tom de Voz e Público</CardTitle>
          <CardDescription>A IA usará isso para gerar captions personalizadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tom de comunicação</Label>
            <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Como sua empresa se comunica?" />
              </SelectTrigger>
              <SelectContent>
                {tones.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Público-alvo</Label>
            <Textarea
              placeholder="Ex: Empresários e gestores de médias empresas, 35-55 anos, que buscam soluções tecnológicas..."
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full" disabled={loading}>
        <Save className="w-4 h-4 mr-2" />
        {loading ? "Salvando..." : "Salvar Perfil"}
      </Button>
    </div>
  );
}
