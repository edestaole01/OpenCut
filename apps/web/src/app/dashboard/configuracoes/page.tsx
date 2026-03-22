"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Brain, Check, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const providers = [
  { id: "gemini", name: "Google Gemini", color: "text-blue-500", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "openai", name: "OpenAI", color: "text-green-500", models: ["gpt-4o", "gpt-4o-mini", "whisper-1"] },
  { id: "anthropic", name: "Anthropic Claude", color: "text-purple-500", models: ["claude-3-5-sonnet", "claude-3-haiku"] },
  { id: "groq", name: "Groq", color: "text-yellow-500", models: ["llama-3.3-70b", "whisper-large-v3"] },
];

const features = [
  { id: "clips", label: "Sugestão de Clips" },
  { id: "captions", label: "Legendas Automáticas" },
  { id: "linkedin", label: "Caption LinkedIn" },
  { id: "instagram", label: "Caption Instagram" },
  { id: "thumbnail", label: "Gerador de Thumbnail" },
  { id: "score", label: "Score Viral" },
];

export default function ConfiguracoesPage() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, string>>({ gemini: "" });
  const [featureModels, setFeatureModels] = useState<Record<string, string>>({
    clips: "gemini-2.0-flash",
    captions: "gemini-2.0-flash",
    linkedin: "gemini-2.0-flash",
    instagram: "gemini-2.0-flash",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas IAs e preferências</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle>Chaves de API</CardTitle>
          </div>
          <CardDescription>Adicione suas chaves para cada provedor de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`font-medium text-sm ${provider.color}`}>{provider.name}</p>
                  {keys[provider.id] && (
                    <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" /> Configurado
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type={showKeys[provider.id] ? "text" : "password"}
                    placeholder={`Chave ${provider.name}`}
                    value={keys[provider.id] || ""}
                    onChange={(e) => setKeys({ ...keys, [provider.id]: e.target.value })}
                    className="text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowKeys({ ...showKeys, [provider.id]: !showKeys[provider.id] })}
                  >
                    {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button className="w-full">Salvar Chaves</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle>IA por Funcionalidade</CardTitle>
          </div>
          <CardDescription>Escolha qual modelo usar para cada função</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {features.map((feature) => (
            <div key={feature.id} className="flex items-center justify-between">
              <Label className="text-sm">{feature.label}</Label>
              <Select
                value={featureModels[feature.id] || "gemini-2.0-flash"}
                onValueChange={(value) => setFeatureModels({ ...featureModels, [feature.id]: value })}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.flatMap(p => p.models.map(m => (
                    <SelectItem key={`${p.id}-${m}`} value={m}>
                      {p.name} — {m}
                    </SelectItem>
                  )))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button className="w-full mt-2">Salvar Configurações</Button>
        </CardContent>
      </Card>
    </div>
  );
}
