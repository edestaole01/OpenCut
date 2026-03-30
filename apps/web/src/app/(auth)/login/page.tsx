"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
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
import { Shield, User } from "lucide-react";

const demoAccounts = [
	{
		label: "Entrar como Admin",
		email: "admin@videoai.com",
		password: "admin123456",
		icon: Shield,
		variant: "default" as const,
	},
	{
		label: "Entrar como Usuário",
		email: "user@videoai.com",
		password: "user123456",
		icon: User,
		variant: "outline" as const,
	},
];

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const result = await signIn.email({ email, password });
			if (result.error) {
				setError("Email ou senha incorretos.");
			} else {
				router.push("/dashboard");
			}
		} catch {
			setError("Erro ao fazer login. Tente novamente.");
		} finally {
			setLoading(false);
		}
	};

	const handleDemoLogin = async (
		email: string,
		password: string,
		label: string,
	) => {
		setLoadingDemo(label);
		setError("");
		try {
			const result = await signIn.email({ email, password });
			if (result.error) {
				setError("Conta demo não encontrada. Crie uma conta primeiro.");
			} else {
				router.push("/dashboard");
			}
		} catch {
			setError("Erro ao fazer login demo.");
		} finally {
			setLoadingDemo(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Entrar</CardTitle>
				<CardDescription>Acesse sua conta VideoAI</CardDescription>
			</CardHeader>
			<form onSubmit={handleLogin}>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Demo accounts */}
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground font-medium uppercase">
							Acesso rápido para teste
						</p>
						<div className="grid grid-cols-2 gap-2">
							{demoAccounts.map((account) => (
								<Button
									key={account.label}
									type="button"
									variant={account.variant}
									size="sm"
									className="w-full gap-2"
									disabled={loadingDemo === account.label}
									onClick={() =>
										handleDemoLogin(
											account.email,
											account.password,
											account.label,
										)
									}
								>
									<account.icon className="w-3 h-3" />
									{loadingDemo === account.label
										? "Entrando..."
										: account.label}
								</Button>
							))}
						</div>
					</div>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-card px-2 text-muted-foreground">
								ou entre com email
							</span>
						</div>
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
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
				</CardContent>
				<CardFooter className="flex flex-col gap-3">
					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Entrando..." : "Entrar"}
					</Button>
					<p className="text-sm text-muted-foreground text-center">
						Não tem conta?{" "}
						<Link href="/register" className="text-primary hover:underline">
							Criar conta
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
