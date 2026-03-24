import type { WebGLEffectRenderer } from "@/types/effects";

export interface TransitionDefinition {
	type: string;
	name: string;
	renderer: WebGLEffectRenderer;
}

export const TRANSITION_DEFINITIONS: TransitionDefinition[] = [
	{
		type: "zoom-in",
		name: "Zoom In",
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 vTextureCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							float scale = mix(0.1, 1.0, uProgress);
							vec2 centeredCoord = vTextureCoord - 0.5;
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
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 vTextureCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;

						void main() {
							float scale = mix(1.0, 3.0, 1.0 - uProgress);
							vec2 centeredCoord = vTextureCoord - 0.5;
							vec2 scaledCoord = centeredCoord / scale + 0.5;
							
							gl_FragColor = texture2D(uSampler, vTextureCoord) * uProgress;
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
		renderer: {
			type: "webgl",
			passes: [
				{
					fragmentShader: `
						precision mediump float;
						varying vec2 vTextureCoord;
						uniform sampler2D uSampler;
						uniform float uProgress;
						uniform vec2 uResolution;

						void main() {
							float blurAmount = mix(20.0, 0.0, uProgress) / uResolution.x;
							vec4 sum = vec4(0.0);
							
							// Simple 9-tap blur
							sum += texture2D(uSampler, vTextureCoord + vec2(-1.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(0.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(1.0, -1.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(-1.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(0.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(1.0, 0.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(-1.0, 1.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(0.0, 1.0) * blurAmount);
							sum += texture2D(uSampler, vTextureCoord + vec2(1.0, 1.0) * blurAmount);
							
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
];

export function getTransition(type: string): TransitionDefinition | undefined {
	return TRANSITION_DEFINITIONS.find((t) => t.type === type);
}
