"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { nanoid } from "nanoid";

interface Character {
	id: string;
	name: string;
	role: string;
	linkedin: string;
	instagram: string;
}

const roles = [
	"CEO / Fundador",
	"Diretor",
	"Gerente",
	"Especialista",
	"Consultor",
	"Palestrante",
	"Influenciador",
	"Apresentador",
	"Outro",
];

export default function PersonagensPage() {
	const [characters, setCharacters] = useState<Character[]>([]);
	const [loading, setLoading] = useState(false);
	const [saved, setSaved] = useState(false);
	const [fetching, setFetching] = useState(true);

	useEffect(() => {
		fetch("/api/speakers")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data) && data.length > 0) {
					const list = data as Character[];
					setCharacters(
						list.map((s) => ({
							id: s.id,
							name: s.name || "",
							role: s.role || "",
							linkedin: s.linkedin || "",
							instagram: s.instagram || "",
						})),
					);
				} else {
					setCharacters([
						{ id: nanoid(), name: "", role: "", linkedin: "", instagram: "" },
					]);
				}
			})
			.catch(() => {
				setCharacters([
					{ id: nanoid(), name: "", role: "", linkedin: "", instagram: "" },
				]);
			})
			.finally(() => setFetching(false));
	}, []);

	const addCharacter = () => {
		setCharacters([
			...characters,
			{ id: nanoid(), name: "", role: "", linkedin: "", instagram: "" },
		]);
	};

	const removeCharacter = (id: string) => {
		if (characters.length === 1) return;
		setCharacters(characters.filter((c) => c.id !== id));
	};

	const updateCharacter = (
		id: string,
		field: keyof Character,
		value: string,
	) => {
		setCharacters(
			characters.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
		);
	};

	const handleSave = async () => {
		const valid = characters.filter((c) => c.name.trim());
		if (valid.length === 0) {
			toast.error("Adicione pelo menos um personagem com nome");
			return;
		}
		setLoading(true);
		try {
			const res = await fetch("/api/speakers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ speakersList: valid }),
			});
			if (!res.ok) throw new Error("Erro ao salvar");
			const saved_list = await res.json();
			setCharacters(
				(saved_list as Character[]).map((s) => ({
					id: s.id,
					name: s.name || "",
					role: s.role || "",
					linkedin: s.linkedin || "",
					instagram: s.instagram || "",
				})),
			);
			setSaved(true);
			toast.success("Personagens salvos!");
			setTimeout(() => setSaved(false), 3000);
		} catch {
			toast.error("Erro ao salvar personagens");
		} finally {
			setLoading(false);
		}
	};

	if (fetching) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-8 max-w-2xl">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Users className="w-7 h-7 text-primary" />
					<div>
						<h1 className="text-3xl font-bold">Personagens</h1>
						<p className="text-muted-foreground">
							Cadastre as pessoas que aparecem nos vídeos
						</p>
					</div>
				</div>
				<Badge variant="secondary">{characters.length} cadastrado(s)</Badge>
			</div>

			<div className="space-y-4">
				{characters.map((character, index) => (
					<Card key={character.id}>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">
									Personagem {index + 1}
								</CardTitle>
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
									<Label>Nome completo *</Label>
									<Input
										placeholder="Ex: João Silva"
										value={character.name}
										onChange={(e) =>
											updateCharacter(character.id, "name", e.target.value)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Cargo / Função</Label>
									<Select
										value={character.role}
										onValueChange={(v) =>
											updateCharacter(character.id, "role", v)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione" />
										</SelectTrigger>
										<SelectContent>
											{roles.map((r) => (
												<SelectItem key={r} value={r}>
													{r}
												</SelectItem>
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
										onChange={(e) =>
											updateCharacter(character.id, "linkedin", e.target.value)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Instagram</Label>
									<Input
										placeholder="@joaosilva"
										value={character.instagram}
										onChange={(e) =>
											updateCharacter(character.id, "instagram", e.target.value)
										}
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

			<Button className="w-full gap-2" onClick={handleSave} disabled={loading}>
				{loading ? (
					<>
						<Loader2 className="w-4 h-4 animate-spin" />
						Salvando...
					</>
				) : saved ? (
					<>
						<CheckCircle2 className="w-4 h-4" />
						Salvo!
					</>
				) : (
					<>
						<Save className="w-4 h-4" />
						Salvar Personagens
					</>
				)}
			</Button>
		</div>
	);
}
