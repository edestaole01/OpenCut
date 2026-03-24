export interface CaptionPreset {
	id: string;
	name: string;
	styles: {
		fontSize: number;
		fontWeight: string;
		fontFamily?: string;
		color?: string;
		strokeColor?: string;
		strokeWidth?: number;
		shadowColor?: string;
		shadowBlur?: number;
		textCase?: "uppercase" | "lowercase" | "capitalize" | "none";
		background?: {
			enabled: boolean;
			color: string;
			cornerRadius: number;
			paddingX: number;
			paddingY: number;
		};
	};
	animations?: {
		entry?: "pop" | "fade" | "slide-up" | "zoom-in" | "bounce";
		highlight?: "bounce" | "color-flash" | "glow" | "shake";
	};
}

export const CAPTION_PRESETS: CaptionPreset[] = [
	{
		id: "hormozi",
		name: "Alex Hormozi",
		styles: {
			fontSize: 72,
			fontWeight: "black",
			color: "#FFFF00", // Yellow
			strokeColor: "#000000",
			strokeWidth: 6,
			textCase: "uppercase",
			fontFamily: "Inter",
		},
		animations: {
			entry: "pop",
			highlight: "bounce",
		},
	},
	{
		id: "mrbeast",
		name: "MrBeast Style",
		styles: {
			fontSize: 64,
			fontWeight: "black",
			color: "#FFFFFF",
			strokeColor: "#00BAF2", // Cyan blue
			strokeWidth: 8,
			textCase: "uppercase",
			fontFamily: "Inter",
			shadowColor: "rgba(0,0,0,0.5)",
			shadowBlur: 10,
		},
		animations: {
			entry: "bounce",
			highlight: "glow",
		},
	},
	{
		id: "iman-gadzhi",
		name: "Minimal Luxury",
		styles: {
			fontSize: 42,
			fontWeight: "medium",
			color: "#FFFFFF",
			textCase: "none",
			fontFamily: "Playfair Display", // Serif font
			background: {
				enabled: true,
				color: "rgba(0,0,0,0.8)",
				cornerRadius: 2,
				paddingX: 12,
				paddingY: 6,
			}
		},
		animations: {
			entry: "fade",
		},
	},
	{
		id: "gaming-glitch",
		name: "Gaming/Glitch",
		styles: {
			fontSize: 58,
			fontWeight: "black",
			color: "#00FF00", // Neon green
			textCase: "uppercase",
			strokeColor: "#FF00FF",
			strokeWidth: 4,
		},
		animations: {
			entry: "pop",
			highlight: "shake",
		},
	},
	{
		id: "clean-modern",
		name: "Clean Modern",
		styles: {
			fontSize: 48,
			fontWeight: "bold",
			color: "#FFFFFF",
			textCase: "none",
			background: {
				enabled: true,
				color: "#3B82F6", // Blue
				cornerRadius: 8,
				paddingX: 16,
				paddingY: 8,
			}
		},
		animations: {
			entry: "slide-up",
		},
	},
];
