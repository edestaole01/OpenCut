import type { TimelineElement } from "@/types/timeline";

export function rippleShiftElements({
	elements,
	afterTime,
	shiftAmount,
}: {
	elements: TimelineElement[];
	afterTime: number;
	shiftAmount: number;
}): TimelineElement[] {
	return elements.map((element) =>
		element.startTime >= afterTime
			? { ...element, startTime: element.startTime - shiftAmount }
			: element,
	);
}

export function closeGapsOnTrack({
	elements,
}: {
	elements: TimelineElement[];
}): TimelineElement[] {
	if (elements.length === 0) return [];

	const sortedElements = [...elements].sort((a, b) => a.startTime - b.startTime);
	const updatedElements: TimelineElement[] = [];
	let nextStartTime = 0;

	for (const element of sortedElements) {
		const updatedElement = {
			...element,
			startTime: nextStartTime,
		};
		updatedElements.push(updatedElement);
		nextStartTime += element.duration;
	}

	return updatedElements;
}
