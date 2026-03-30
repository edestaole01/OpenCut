"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Video,
	Share2,
	BarChart2,
	Settings,
	Users,
	LogOut,
	Zap,
	Building2,
	UserCircle,
	Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const menuItems = [
	{ icon: LayoutDashboard, label: "Início", href: "/dashboard" },
	{ icon: Zap, label: "AI Studio", href: "/dashboard/ai-studio" },
	{ icon: Sparkles, label: "Captions IA", href: "/dashboard/captions" },
	{ icon: Video, label: "Projetos", href: "/dashboard/projetos" },
	{
		icon: Share2,
		label: "Redes Sociais",
		href: "/dashboard/redes-sociais",
		badge: "Beta",
	},
	{
		icon: BarChart2,
		label: "Analytics",
		href: "/dashboard/analytics",
		badge: "Breve",
	},
];

const configItems = [
	{ icon: Building2, label: "Empresa", href: "/dashboard/empresa" },
	{ icon: UserCircle, label: "Personagens", href: "/dashboard/personagens" },
	{ icon: Settings, label: "Configurações", href: "/dashboard/configuracoes" },
];

const adminItems = [
	{ icon: Users, label: "Usuários", href: "/dashboard/admin" },
];

export function Sidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	const safeSession = isHydrated ? session : null;
	const userRole = (safeSession?.user as { role?: string } | null)?.role;
	const isAdmin = userRole === "admin";
	const userInitial = safeSession?.user?.name?.charAt(0)?.toUpperCase() || "U";
	const userName = safeSession?.user?.name || "Usuário";
	const userEmail = safeSession?.user?.email || "";

	const handleLogout = async () => {
		await signOut();
		router.push("/login");
	};

	return (
		<aside className="w-64 h-screen bg-card border-r flex flex-col fixed left-0 top-0 z-50">
			<div className="p-6 border-b">
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
						<span className="text-primary-foreground font-bold text-sm">V</span>
					</div>
					<span className="font-bold text-lg">VideoAI</span>
				</div>
			</div>

			<nav className="flex-1 p-4 space-y-1 overflow-y-auto">
				{menuItems.map((item) => (
					<Link key={item.href} href={item.href}>
						<div
							className={cn(
								"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer group",
								pathname === item.href
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							)}
						>
							<item.icon className="w-4 h-4" />
							<span className="flex-1">{item.label}</span>
							{item.badge && (
								<span
									className={cn(
										"text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider",
										pathname === item.href
											? "bg-primary-foreground/20 text-primary-foreground"
											: "bg-muted text-muted-foreground group-hover:bg-accent-foreground/10",
									)}
								>
									{item.badge}
								</span>
							)}
						</div>
					</Link>
				))}

				<div className="pt-4 pb-2">
					<p className="text-xs font-semibold text-muted-foreground uppercase px-3">
						Configurações
					</p>
				</div>
				{configItems.map((item) => (
					<Link key={item.href} href={item.href}>
						<div
							className={cn(
								"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
								pathname === item.href
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							)}
						>
							<item.icon className="w-4 h-4" />
							{item.label}
						</div>
					</Link>
				))}

				{isAdmin && (
					<>
						<div className="pt-4 pb-2">
							<p className="text-xs font-semibold text-muted-foreground uppercase px-3">
								Administração
							</p>
						</div>
						{adminItems.map((item) => (
							<Link key={item.href} href={item.href}>
								<div
									className={cn(
										"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
										pathname === item.href
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
									)}
								>
									<item.icon className="w-4 h-4" />
									{item.label}
								</div>
							</Link>
						))}
					</>
				)}
			</nav>

			<div className="p-4 border-t">
				<div className="flex items-center gap-3 mb-3">
					<Avatar className="w-8 h-8">
						<AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium truncate">{userName}</p>
						<p className="text-xs text-muted-foreground truncate">
							{userEmail}
						</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="w-full justify-start text-muted-foreground hover:text-destructive"
					onClick={handleLogout}
				>
					<LogOut className="w-4 h-4 mr-2" />
					Sair
				</Button>
			</div>
		</aside>
	);
}
