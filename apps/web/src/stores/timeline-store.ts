"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClipboardItem } from "@/types/timeline";

interface TimelineStore {
	snappingEnabled: boolean;
	toggleSnapping: () => void;
	rippleEditingEnabled: boolean;
	toggleRippleEditing: () => void;
	isBladeModeEnabled: boolean;
	toggleBladeMode: () => void;
	autoKeyframingEnabled: boolean;
	toggleAutoKeyframing: () => void;
	clipboard: {
		items: ClipboardItem[];
	} | null;
	setClipboard: (clipboard: { items: ClipboardItem[] } | null) => void;
}

export const useTimelineStore = create<TimelineStore>()(
	persist(
		(set) => ({
			snappingEnabled: true,
			toggleSnapping: () => {
				set((state) => ({ snappingEnabled: !state.snappingEnabled }));
			},

			rippleEditingEnabled: false,
			toggleRippleEditing: () => {
				set((state) => ({
					rippleEditingEnabled: !state.rippleEditingEnabled,
				}));
			},

			isBladeModeEnabled: false,
			toggleBladeMode: () => {
				set((state) => ({ isBladeModeEnabled: !state.isBladeModeEnabled }));
			},

			autoKeyframingEnabled: false,
			toggleAutoKeyframing: () => {
				set((state) => ({ autoKeyframingEnabled: !state.autoKeyframingEnabled }));
			},

			clipboard: null,
			setClipboard: (clipboard) => {
				set({ clipboard });
			},
		}),
		{
			name: "timeline-store",
			partialize: (state) => ({
				snappingEnabled: state.snappingEnabled,
				rippleEditingEnabled: state.rippleEditingEnabled,
			}),
		},
	),
);
