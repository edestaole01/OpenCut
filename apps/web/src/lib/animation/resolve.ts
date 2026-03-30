import type {
	AnimationPropertyPath,
	ElementAnimations,
} from "@/types/animation";
import type { Transform } from "@/types/timeline";
import {
	getColorValueAtTime,
	getNumberChannelValueAtTime,
} from "./interpolation";
import { getColorChannelForPath } from "./color-channel";
import { getNumberChannelForPath } from "./number-channel";

export function getElementLocalTime({
	timelineTime,
	elementStartTime,
	elementDuration,
}: {
	timelineTime: number;
	elementStartTime: number;
	elementDuration: number;
}): number {
	const localTime = timelineTime - elementStartTime;
	if (localTime <= 0) {
		return 0;
	}

	if (localTime >= elementDuration) {
		return elementDuration;
	}

	return localTime;
}

export function resolveTransformAtTime({
	baseTransform,
	animations,
	localTime,
}: {
	baseTransform: Transform;
	animations: ElementAnimations | undefined;
	localTime: number;
}): Transform {
	const safeLocalTime = Math.max(0, localTime);
	return {
		position: {
			x: getNumberChannelValueAtTime({
				channel: getNumberChannelForPath({
					animations,
					propertyPath: "transform.position.x",
				}),
				time: safeLocalTime,
				fallbackValue: baseTransform.position.x,
			}),
			y: getNumberChannelValueAtTime({
				channel: getNumberChannelForPath({
					animations,
					propertyPath: "transform.position.y",
				}),
				time: safeLocalTime,
				fallbackValue: baseTransform.position.y,
			}),
		},
		scale: getNumberChannelValueAtTime({
			channel: getNumberChannelForPath({
				animations,
				propertyPath: "transform.scale",
			}),
			time: safeLocalTime,
			fallbackValue: baseTransform.scale,
		}),
		rotate: getNumberChannelValueAtTime({
			channel: getNumberChannelForPath({
				animations,
				propertyPath: "transform.rotate",
			}),
			time: safeLocalTime,
			fallbackValue: baseTransform.rotate,
		}),
	};
}

export function resolveOpacityAtTime({
	baseOpacity,
	animations,
	localTime,
	elementDuration,
	fadeIn = 0,
	fadeOut = 0,
}: {
	baseOpacity: number;
	animations: ElementAnimations | undefined;
	localTime: number;
	elementDuration: number;
	fadeIn?: number;
	fadeOut?: number;
}): number {
	const animatedOpacity = getNumberChannelValueAtTime({
		channel: getNumberChannelForPath({
			animations,
			propertyPath: "opacity",
		}),
		time: Math.max(0, localTime),
		fallbackValue: baseOpacity,
	});

	let fadeMultiplier = 1;
	if (localTime < fadeIn) {
		fadeMultiplier = localTime / fadeIn;
	} else if (localTime > elementDuration - fadeOut) {
		fadeMultiplier = (elementDuration - localTime) / fadeOut;
	}

	return animatedOpacity * Math.max(0, Math.min(1, fadeMultiplier));
}

export function resolveNumberAtTime({
	baseValue,
	animations,
	propertyPath,
	localTime,
}: {
	baseValue: number;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	localTime: number;
}): number {
	return getNumberChannelValueAtTime({
		channel: getNumberChannelForPath({ animations, propertyPath }),
		time: Math.max(0, localTime),
		fallbackValue: baseValue,
	});
}

export function resolveColorAtTime({
	baseColor,
	animations,
	propertyPath,
	localTime,
}: {
	baseColor: string;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	localTime: number;
}): string {
	return getColorValueAtTime({
		channel: getColorChannelForPath({ animations, propertyPath }),
		time: Math.max(0, localTime),
		fallbackValue: baseColor,
	});
}

export function resolveVolumeAtTime({
	baseVolume,
	animations,
	localTime,
	elementDuration,
	fadeIn = 0,
	fadeOut = 0,
}: {
	baseVolume: number;
	animations: ElementAnimations | undefined;
	localTime: number;
	elementDuration: number;
	fadeIn?: number;
	fadeOut?: number;
}): number {
	const animatedVolume = getNumberChannelValueAtTime({
		channel: getNumberChannelForPath({
			animations,
			propertyPath: "volume",
		}),
		time: Math.max(0, localTime),
		fallbackValue: baseVolume,
	});

	let fadeMultiplier = 1;
	if (localTime < fadeIn) {
		fadeMultiplier = localTime / fadeIn;
	} else if (localTime > elementDuration - fadeOut) {
		fadeMultiplier = (elementDuration - localTime) / fadeOut;
	}

	return animatedVolume * Math.max(0, Math.min(1, fadeMultiplier));
}
