"use client";

import { useState, } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Search01Icon, Image02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@/components/ui/spinner";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import Image from "next/image";

// Mock data for stock media
const MOCK_STOCK_ITEMS = [
	{ id: "1", type: "video", name: "Ocean Waves", previewUrl: "https://images.pexels.com/photos/1001633/pexels-photo-1001633.jpeg?auto=compress&cs=tinysrgb&w=160", url: "https://images.pexels.com/photos/1001633/pexels-photo-1001633.jpeg" },
	{ id: "2", type: "image", name: "Mountain Peak", previewUrl: "https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=160", url: "https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg" },
	{ id: "3", type: "video", name: "Forest Path", previewUrl: "https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=160", url: "https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg" },
];

export function StockView() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [provider, setProvider] = useState<"pexels" | "giphy">("pexels");

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setIsSearching(true);
		setTimeout(() => setIsSearching(false), 800); // Simulate network
	};

	return (
		<PanelView 
			title="Stock Media"
			actions={
				<div className="flex items-center gap-1.5">
					<div className="bg-muted flex items-center rounded-md p-0.5">
						<Button 
							variant={provider === "pexels" ? "secondary" : "ghost"} 
							size="sm" 
							className="h-7 px-2 text-xs"
							onClick={() => setProvider("pexels")}
						>
							Pexels
						</Button>
						<Button 
							variant={provider === "giphy" ? "secondary" : "ghost"} 
							size="sm" 
							className="h-7 px-2 text-xs"
							onClick={() => setProvider("giphy")}
						>
							Giphy
						</Button>
					</div>
				</div>
			}
		>
			<div className="flex h-full flex-col gap-4">
				<form onSubmit={handleSearch} className="relative">
					<HugeiconsIcon icon={Search01Icon} className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
					<input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={`Search ${provider === "pexels" ? "videos & photos" : "GIFs"}...`}
						className="bg-muted focus-visible:ring-ring w-full rounded-md py-2 pr-3 pl-9 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2"
					/>
				</form>

				{isSearching ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner className="text-muted-foreground size-6" />
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
						{MOCK_STOCK_ITEMS.map((item) => (
							<StockItem key={item.id} item={item} />
						))}
					</div>
				)}
			</div>
		</PanelView>
	);
}

function StockItem({ item }: { item: any }) {
	const preview = (
		<div className="relative size-full overflow-hidden rounded-sm">
			<Image 
				src={item.previewUrl} 
				alt={item.name} 
				fill 
				className="object-cover transition-transform hover:scale-110"
				unoptimized
			/>
			<div className="absolute right-1 bottom-1 rounded bg-black/60 p-1">
				<HugeiconsIcon icon={item.type === "video" ? Video01Icon : Image02Icon} className="size-3 text-white" />
			</div>
		</div>
	);

	return (
		<DraggableItem
			name={item.name}
			preview={preview}
			dragData={{
				id: `stock-${item.id}`,
				type: "media",
				mediaType: item.type,
				name: item.name,
			}}
			aspectRatio={1}
			variant="card"
			containerClassName="w-full"
		/>
	);
}
