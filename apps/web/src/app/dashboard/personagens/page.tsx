"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Character {
  id: string;
  name: string;
  role: string;
  linkedin: string;
  instagram: string;
}

export default function PersonagensPage() {
  const [characters, setCharacters] = useState<Character[]>([
    { id: "1", name: "", role: "", linkedin: "", instagram: "" }
  ]);

  const addCharacter = () => {
    setCharacters([...characters, {
      id: Date.now().toString(),
      name: "", role: "", linkedin: "", instagram: ""
    }]);
  };

  const removeCharacter = (id: string) => {
    if (characters.length === 1) return;
    setCharacters(characters.filter(c => c.id !== id));
  };

  const updateCharacter = (id: string, field: keyof Character, value: string) => {
    setCharacters(characters.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = () => {
    toast.success("Personagens salvos com sucesso!");
  };

  const roles = [
    "CEO / Fundador", "Diretor", "Gerente", "Especialista",
    "Consultor", "Palestrante", "Influenciador", "Apresentador", "Outro"
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Personagens</h1>
            <p className="text-muted-foreground">Cadastre as pessoas que aparecem nos vídeos</p>
          </div>
        </div>
        <Badge variant="secondary">{characters.length} cadastrado(s)</Badge>
      </div>

      <div className="space-y-4">
        {characters.map((character, index) => (
          <Card key={character.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Personagem {index + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeCharacter(character.id)}
                  disabled={characters.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={character.name}
                    onChange={(e) => updateCharacter(character.id, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo / Função</Label>
                  <Select
                    value={character.role}
                    onValueChange={(v) => updateCharacter(character.id, "role", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input
                    placeholder="linkedin.com/in/joaosilva"
                    value={character.linkedin}
                    onChange={(e) => updateCharacter(character.id, "linkedin", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input
                    placeholder="@joaosilva"
                    value={character.instagram}
                    onChange={(e) => updateCharacter(character.id, "instagram", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={addCharacter}>
        <Plus className="w-4 h-4 mr-2" />
        Adicionar personagem
      </Button>

      <Button className="w-full" onClick={handleSave}>
        <Save className="w-4 h-4 mr-2" />
        Salvar Personagens
      </Button>
    </div>
  );
}
