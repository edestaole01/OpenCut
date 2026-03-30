import { hasEffect, registerEffect } from "../registry";
import { blurEffectDefinition } from "./blur";
import { vignetteEffectDefinition } from "./vignette";
import { pixelateEffectDefinition } from "./pixelate";
import { grayscaleEffectDefinition } from "./grayscale";
import { vhsEffectDefinition } from "./vhs";

const defaultEffects = [
	blurEffectDefinition,
	vignetteEffectDefinition,
	pixelateEffectDefinition,
	grayscaleEffectDefinition,
	vhsEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}
