import { redirect } from "next/navigation";

// Raiz sempre redireciona — o proxy.ts decide para onde baseado na sessão.
// Este fallback garante que, mesmo sem middleware, o usuário não veja a landing do OpenCut.
export default function Home() {
	redirect("/dashboard/ai-studio");
}
