import type { EffectDefinition } from "@/types/effects";
import fragmentShader from "./vignette.frag.glsl";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vinheta",
	description: "Escurece as bordas para focar a atenção no centro.",
	params: [
		{
			id: "intensity",
			name: "Intensidade",
			type: "number",
			default: 0.8,
			min: 0,
			max: 1.5,
		},
		{
			id: "smoothness",
			name: "Suavidade",
			type: "number",
			default: 0.5,
			min: 0.1,
			max: 1.0,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader,
				uniforms: ({ effectParams }) => ({
					uIntensity: effectParams.intensity as number,
					uSmoothness: effectParams.smoothness as number,
				}),
			},
		],
	},
};
