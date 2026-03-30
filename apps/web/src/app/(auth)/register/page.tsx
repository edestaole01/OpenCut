"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const result = await signUp.email({ name, email, password });
			if (result.error) {
				setError("Erro ao criar conta. Tente outro email.");
			} else {
				router.push("/dashboard");
			}
		} catch {
			setError("Erro ao criar conta. Tente novamente.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Criar conta</CardTitle>
				<CardDescription>Comece a usar o VideoAI gratuitamente</CardDescription>
			</CardHeader>
			<form onSubmit={handleRegister}>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<div className="space-y-2">
						<Label htmlFor="name">Nome completo</Label>
						<Input
							id="name"
							placeholder="Seu nome"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="seu@email.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Senha</Label>
						<Input
							id="password"
							type="password"
							placeholder="Mínimo 8 caracteres"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							minLength={8}
							required
						/>
					</div>
				</CardContent>
				<CardFooter className="flex flex-col gap-3">
					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Criando conta..." : "Criar conta"}
					</Button>
					<p className="text-sm text-muted-foreground text-center">
						Já tem conta?{" "}
						<Link href="/login" className="text-primary hover:underline">
							Entrar
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
