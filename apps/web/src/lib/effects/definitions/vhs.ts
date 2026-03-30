import type { EffectDefinition } from "@/types/effects";
import fragmentShader from "./vhs.frag.glsl";

export const vhsEffectDefinition: EffectDefinition = {
	type: "vhs",
	name: "VHS Glitch",
	description: "Efeito retrô com deslocamento de cores e ruído analógico.",
	params: [
		{
			id: "amount",
			name: "Intensidade",
			type: "number",
			default: 1.0,
			min: 0,
			max: 3.0,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader,
				uniforms: ({ effectParams, time }) => ({
					uAmount: effectParams.amount as number,
					uTime: time || 0,
				}),
			},
		],
	},
};
