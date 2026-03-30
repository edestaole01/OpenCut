"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { type Tab, useAssetsPanelStore } from "@/stores/assets-panel-store";
import { TabBar } from "./tabbar";

const MediaView = dynamic(() =>
	import("./views/assets").then((m) => m.MediaView),
);
const StockView = dynamic(() =>
	import("./views/stock").then((m) => m.StockView),
);
const SoundsView = dynamic(() =>
	import("./views/sounds").then((m) => m.SoundsView),
);
const TextView = dynamic(() => import("./views/text").then((m) => m.TextView));
const StickersView = dynamic(() =>
	import("./views/stickers").then((m) => m.StickersView),
);
const EffectsView = dynamic(() =>
	import("./views/effects").then((m) => m.EffectsView),
);
const TransitionsView = dynamic(() =>
	import("./views/transitions").then((m) => m.TransitionsView),
);
const Captions = dynamic(() =>
	import("./views/captions").then((m) => m.Captions),
);
const SettingsView = dynamic(() =>
	import("./views/settings").then((m) => m.SettingsView),
);

const TAB_VIEWS: Record<Tab, React.ReactNode> = {
	media: <MediaView />,
	stock: <StockView />,
	sounds: <SoundsView />,
	text: <TextView />,
	stickers: <StickersView />,
	effects: <EffectsView />,
	transitions: <TransitionsView />,
	captions: <Captions />,
	filters: (
		<div className="text-muted-foreground p-4">Filters view coming soon...</div>
	),
	adjustment: (
		<div className="text-muted-foreground p-4">
			Adjustment view coming soon...
		</div>
	),
	settings: <SettingsView />,
};

export function AssetsPanel() {
	const activeTab = useAssetsPanelStore((s) => s.activeTab);

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<div className="bg-muted/30 border-r shrink-0 h-full">
				<TabBar />
			</div>
			<div className="flex-1 overflow-hidden">
				<Suspense
					fallback={
						<div className="p-4 text-muted-foreground text-sm">
							Carregando...
						</div>
					}
				>
					{TAB_VIEWS[activeTab]}
				</Suspense>
			</div>
		</div>
	);
}
