import type { EffectDefinition } from "@/types/effects";
import fragmentShader from "./grayscale.frag.glsl";

export const grayscaleEffectDefinition: EffectDefinition = {
	type: "grayscale",
	name: "Preto e Branco",
	description: "Remove a saturação da imagem para um visual clássico.",
	params: [
		{
			id: "intensity",
			name: "Intensidade",
			type: "number",
			default: 1.0,
			min: 0,
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
				}),
			},
		],
	},
};
