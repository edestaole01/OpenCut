import type { EffectDefinition } from "@/types/effects";
import fragmentShader from "./pixelate.frag.glsl";

export const pixelateEffectDefinition: EffectDefinition = {
	type: "pixelate",
	name: "Pixelate",
	description: "Transforma a imagem em pixels grandes estilizados.",
	params: [
		{
			id: "pixelSize",
			name: "Tamanho do Pixel",
			type: "number",
			default: 10,
			min: 2,
			max: 100,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader,
				uniforms: ({ effectParams, width, height }) => ({
					uPixelSize: effectParams.pixelSize as number,
					uResolution: [width, height],
				}),
			},
		],
	},
};
