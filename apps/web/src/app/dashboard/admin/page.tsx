"use client";
import { useSession } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, Key, Shield } from "lucide-react";

export default function AdminPage() {
	const { data: session } = useSession();
	const router = useRouter();

	useEffect(() => {
		const userRole = (session?.user as { role?: string } | undefined)?.role;
		if (userRole && userRole !== "admin") {
			router.push("/dashboard");
		}
	}, [session, router]);

	return (
		<div className="space-y-8">
			<div className="flex items-center gap-3">
				<Shield className="w-7 h-7 text-primary" />
				<div>
					<h1 className="text-3xl font-bold">Painel Admin</h1>
					<p className="text-muted-foreground">
						Gerencie usuários e configurações do sistema
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{[
					{
						icon: Users,
						label: "Total de Usuários",
						value: "2",
						color: "text-blue-500",
					},
					{
						icon: Activity,
						label: "Usuários Ativos",
						value: "2",
						color: "text-green-500",
					},
					{
						icon: Key,
						label: "IAs Configuradas",
						value: "1",
						color: "text-yellow-500",
					},
					{
						icon: Shield,
						label: "Admins",
						value: "1",
						color: "text-purple-500",
					},
				].map((stat) => (
					<Card key={stat.label}>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<p className="text-sm text-muted-foreground">{stat.label}</p>
								<stat.icon className={`w-4 h-4 ${stat.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{stat.value}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Usuários</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[
							{
								name: "Eduardo",
								email: "eduardo@email.com",
								role: "admin",
								status: "ativo",
							},
							{
								name: "Esposa",
								email: "esposa@email.com",
								role: "user",
								status: "ativo",
							},
						].map((user) => (
							<div
								key={user.email}
								className="flex items-center justify-between p-3 rounded-lg border"
							>
								<div className="flex items-center gap-3">
									<div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
										<span className="text-sm font-semibold text-primary">
											{user.name.charAt(0)}
										</span>
									</div>
									<div>
										<p className="font-medium text-sm">{user.name}</p>
										<p className="text-xs text-muted-foreground">
											{user.email}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={user.role === "admin" ? "default" : "secondary"}
									>
										{user.role === "admin" ? "Admin" : "Usuário"}
									</Badge>
									<Badge
										variant="outline"
										className="text-green-500 border-green-500/30"
									>
										{user.status}
									</Badge>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
