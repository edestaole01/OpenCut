"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import {
	TAB_KEYS,
	tabs,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";

// Portuguese labels for tabs
const PT_LABELS: Record<string, string> = {
	media: "Mídia",
	stock: "Stock",
	sounds: "Sons",
	text: "Texto",
	stickers: "Stickers",
	effects: "Efeitos",
	transitions: "Trans.",
	captions: "Legendas",
	filters: "Filtros",
	adjustment: "Ajuste",
	settings: "Config.",
};

// Dividers appear BEFORE the listed tab key
const DIVIDERS_BEFORE = new Set(["text", "effects", "settings"]);

// Icon colors per tab (inactive state)
const TAB_COLORS: Record<string, string> = {
	media:       "text-blue-400",
	stock:       "text-cyan-400",
	text:        "text-violet-400",
	captions:    "text-indigo-400",
	stickers:    "text-yellow-400",
	sounds:      "text-green-400",
	effects:     "text-orange-400",
	filters:     "text-pink-400",
	adjustment:  "text-rose-400",
	transitions: "text-teal-400",
	settings:    "text-slate-400",
};

export function TabBar() {
	const { activeTab, setActiveTab } = useAssetsPanelStore();
	const [showTopFade, setShowTopFade] = useState(false);
	const [showBottomFade, setShowBottomFade] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const checkScrollPosition = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopFade(scrollTop > 0);
		setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1);
	}, []);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		checkScrollPosition();
		element.addEventListener("scroll", checkScrollPosition);

		const resizeObserver = new ResizeObserver(checkScrollPosition);
		resizeObserver.observe(element);

		return () => {
			element.removeEventListener("scroll", checkScrollPosition);
			resizeObserver.disconnect();
		};
	}, [checkScrollPosition]);

	return (
		<div className="relative flex h-full">
			<div
				ref={scrollRef}
				className="scrollbar-hidden relative flex h-full w-full p-2 flex-col items-center justify-start gap-1 overflow-y-auto"
			>
				{TAB_KEYS.map((tabKey) => {
					const tab = tabs[tabKey];
					const isActive = activeTab === tabKey;
					return (
						<div key={tabKey} className="w-full flex flex-col items-center">
							{DIVIDERS_BEFORE.has(tabKey) && (
								<div className="w-5 my-1.5 border-t border-muted-foreground/30" />
							)}
							<Tooltip delayDuration={300}>
								<TooltipTrigger asChild>
									<Button
										variant="text"
										aria-label={tab.label}
										className={cn(
											"flex-col !px-1 !py-2 !rounded-lg !h-auto !w-full gap-1 [&_svg]:size-[18px] transition-all",
											isActive
												? "bg-primary/10 text-primary hover:bg-primary/15"
												: "text-muted-foreground hover:text-foreground hover:bg-accent",
										)}
										onClick={() => setActiveTab(tabKey)}
									>
										<tab.icon />
										<span className="text-[10px] font-semibold leading-none">
											{PT_LABELS[tabKey] ?? tab.label}
										</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent
									side="right"
									align="center"
									variant="sidebar"
									sideOffset={8}
								>
									<div className="text-foreground text-sm leading-none font-medium">
										{PT_LABELS[tabKey] ?? tab.label}
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
					);
				})}
			</div>

			<FadeOverlay direction="top" show={showTopFade} />
			<FadeOverlay direction="bottom" show={showBottomFade} />
		</div>
	);
}

function FadeOverlay({
	direction,
	show,
}: {
	direction: "top" | "bottom";
	show: boolean;
}) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute right-0 left-0 h-6",
				direction === "top" && show
					? "from-background top-0 bg-gradient-to-b to-transparent"
					: "from-background bottom-0 bg-gradient-to-t to-transparent",
			)}
		/>
	);
}
