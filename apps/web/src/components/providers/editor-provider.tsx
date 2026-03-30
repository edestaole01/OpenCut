"use client";

import type React from "react";
import { createContext, useContext, useMemo, useEffect, useState } from "react";
import { EditorCore } from "@/core";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export const EditorContext = createContext<EditorCore | null>(null);

export function EditorProvider({
	children,
	projectId,
}: {
	children: React.ReactNode;
	projectId?: string;
}) {
	const editor = useMemo(() => EditorCore.getInstance(), []);
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	useEffect(() => {
		let isMounted = true;

		async function init() {
			if (projectId) {
				try {
					await editor.project.loadProject({ id: projectId });
				} catch (err) {
					console.error("Failed to load project in provider:", err);
					if (isMounted) {
						setError(
							err instanceof Error
								? err.message
								: "Não foi possível carregar o projeto",
						);
					}
				}
			}

			if (isMounted) {
				setIsReady(true);
			}
		}

		init();

		return () => {
			isMounted = false;
		};
	}, [editor, projectId]);

	if (error) {
		return (
			<div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4 px-10 text-center">
				<div className="flex flex-col gap-2">
					<h2 className="text-xl font-bold text-foreground">
						Ops! Algo deu errado.
					</h2>
					<p className="text-sm text-muted-foreground">{error}</p>
				</div>
				<Button onClick={() => router.push("/dashboard")} className="gap-2">
					<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
					Voltar ao Dashboard
				</Button>
			</div>
		);
	}

	if (!isReady) {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground animate-pulse">
						Carregando editor...
					</p>
				</div>
			</div>
		);
	}

	return (
		<EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
	);
}

export function useEditorInstance(): EditorCore {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error("useEditorInstance must be used within an EditorProvider");
	}
	return context;
}
