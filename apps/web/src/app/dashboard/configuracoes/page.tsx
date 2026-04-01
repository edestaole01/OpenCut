"use client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Key } from "lucide-react";

export default function ConfiguracoesPage() {
	return (
		<div className="space-y-8">
			<div className="flex items-center gap-3">
				<Settings className="w-7 h-7 text-primary" />
				<div>
					<h1 className="text-3xl font-bold">Configurações</h1>
					<p className="text-muted-foreground">
						A análise usa apenas Groq Llama. Nenhuma configuração adicional é
						necessária aqui.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Key className="w-5 h-5 text-primary" />
						<CardTitle>Provedor</CardTitle>
					</div>
					<CardDescription>Groq Llama 3.3-70b (fixo)</CardDescription>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground space-y-2">
					<p>
						A chave é carregada via variável de ambiente{" "}
						<code className="mx-1">GROQ_API_KEY</code>. Fale com o admin caso
						precise alterar.
					</p>
					<Badge variant="secondary" className="text-amber-700 bg-amber-100">
						Groq ativo
					</Badge>
				</CardContent>
			</Card>
		</div>
	);
}
