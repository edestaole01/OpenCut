import type { WebGLEffectRenderer } from "@/types/effects";

export interface TransitionDefinition {
	type: string;
	name: string;
	description: string;
	renderer: WebGLEffectRenderer;
}

export const TRANSITION_DEFINITIONS: TransitionDefinition[] = [
	{
		type: "zoom-in",
		name: "Zoom In",
		description:
			"Entrada com aproximacao progressiva, bom para destacar o inicio de um trecho.",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 v_texCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							float scale = mix(0.1, 1.0, uProgress);
							vec2 centeredCoord = v_texCoord - 0.5;
							vec2 scaledCoord = centeredCoord / scale + 0.5;
							
							if (scaledCoord.x < 0.0 || scaledCoord.x > 1.0 || scaledCoord.y < 0.0 || scaledCoord.y > 1.0) {
								discard;
							}
							
							gl_FragColor = texture2D(uSampler, scaledCoord) * uProgress;
						}
					`,
					uniforms: ({ effectParams }) => ({
						uProgress: effectParams.progress as number,
					}),
				},
			],
		},
	},
	{
		type: "zoom-out",
		name: "Zoom Out",
		description:
			"Transicao suave de afastamento, util para fechamento de cena ou troca de assunto.",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 v_texCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							float scale = mix(1.0, 3.0, 1.0 - uProgress);
							vec2 centeredCoord = v_texCoord - 0.5;
							vec2 scaledCoord = centeredCoord / scale + 0.5;
							
							gl_FragColor = texture2D(uSampler, v_texCoord) * uProgress;
						}
					`,
					uniforms: ({ effectParams }) => ({
						uProgress: effectParams.progress as number,
					}),
				},
			],
		},
	},
	{
		type: "blur-in",
		name: "Blur In",
		description:
			"Comeca desfocado e revela a imagem aos poucos, ideal para entradas mais cinematograficas.",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 v_texCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;
						uniform vec2 uResolution;

						void main() {
							float blurAmount = mix(20.0, 0.0, uProgress) / uResolution.x;
							vec4 sum = vec4(0.0);
							
							// Simple 9-tap blur
							sum += texture2D(uSampler, v_texCoord + vec2(-1.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(0.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(1.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(-1.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(0.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(1.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(-1.0, 1.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(0.0, 1.0) * blurAmount);
							sum += texture2D(uSampler, v_texCoord + vec2(1.0, 1.0) * blurAmount);
							
							gl_FragColor = (sum / 9.0) * uProgress;
						}
					`,
					uniforms: ({ effectParams, width, height }) => ({
						uProgress: effectParams.progress as number,
						uResolution: [width, height],
					}),
				},
			],
		},
	},
	{
		type: "cross-dissolve",
		name: "Cross Dissolve",
		description: "Transicao suave de opacidade (fade), o clássico do cinema.",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 v_texCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							gl_FragColor = texture2D(uSampler, v_texCoord) * uProgress;
						}
					`,
					uniforms: ({ effectParams }) => ({
						uProgress: effectParams.progress as number,
					}),
				},
			],
		},
	},
	{
		type: "wipe",
		name: "Wipe (Varredura)",
		description: "Revela a imagem com uma linha que se desloca da esquerda para a direita.",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 v_texCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							// Se a coordenada X for maior que o progresso, descarta o pixel
							if (v_texCoord.x > uProgress) {
								discard;
							}
							gl_FragColor = texture2D(uSampler, v_texCoord);
						}
					`,
					uniforms: ({ effectParams }) => ({
						uProgress: effectParams.progress as number,
					}),
				},
			],
		},
	},
];

export function getTransition(type: string): TransitionDefinition | undefined {
	return TRANSITION_DEFINITIONS.find((t) => t.type === type);
}
