import { useCallback, useRef, useSyncExternalStore, useContext } from "react";
import { EditorCore } from "@/core";
import { EditorContext } from "@/components/providers/editor-provider";

const DEFAULT_MANAGERS: Array<keyof EditorCore> = [
	"timeline",
	"scenes",
	"project",
	"media",
	"renderer",
	"selection",
];

type SubscribableManager = {
	subscribe: (listener: () => void) => () => void;
};

function hasSubscribe(manager: unknown): manager is SubscribableManager {
	return (
		typeof manager === "object" &&
		manager !== null &&
		"subscribe" in manager &&
		typeof manager.subscribe === "function"
	);
}

export function useEditor(): EditorCore;
export function useEditor<T>(
	selector: (editor: EditorCore) => T,
	managers?: Array<keyof EditorCore>,
): T;
export function useEditor<T>(
	selector?: (editor: EditorCore) => T,
	managers: Array<keyof EditorCore> = DEFAULT_MANAGERS,
): T | EditorCore {
	const editor = useContext(EditorContext) ?? EditorCore.getInstance();
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const handleStoreChange = () => {
				versionRef.current += 1;
				onStoreChange();
			};

			const unsubscribers: Array<() => void> = [];

			for (const managerKey of managers) {
				const manager = editor[managerKey];
				if (hasSubscribe(manager)) {
					unsubscribers.push(manager.subscribe(handleStoreChange));
				}
			}

			return () => {
				for (const unsubscribe of unsubscribers) {
					unsubscribe();
				}
			};
		},
		[editor, managers],
	);

	const getVersionSnapshot = useCallback(() => versionRef.current, []);
	useSyncExternalStore(subscribe, getVersionSnapshot, getVersionSnapshot);

	return selector ? selector(editor) : editor;
}
