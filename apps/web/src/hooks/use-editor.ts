import { useCallback, useRef, useSyncExternalStore, useContext } from "react";
import { EditorCore } from "@/core";
import { EditorContext } from "@/components/providers/editor-provider";

export function useEditor(): EditorCore;
export function useEditor<T>(
	selector: (editor: EditorCore) => T,
	managers?: Array<keyof EditorCore>,
): T;
export function useEditor<T>(
	selector?: (editor: EditorCore) => T,
	managers: Array<keyof EditorCore> = [
		"timeline",
		"scenes",
		"project",
		"media",
		"renderer",
		"selection",
	],
): T | EditorCore {
	const editor = useContext(EditorContext) ?? EditorCore.getInstance();
	const versionRef = useRef(0);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!selector) return () => {};

			const handleStoreChange = () => {
				versionRef.current += 1;
				onStoreChange();
			};

			const unsubscribers: Array<() => void> = [];

			for (const managerKey of managers) {
				const manager = editor[managerKey];
				if (manager && typeof (manager as any).subscribe === "function") {
					unsubscribers.push((manager as any).subscribe(handleStoreChange));
				}
			}

			return () => {
				for (const unsubscribe of unsubscribers) {
					unsubscribe();
				}
			};
		},
		[editor, selector, managers],
	);

	const getSnapshot = useCallback(() => {
		if (!selector) return editor;
		return selector(editor);
	}, [editor, selector]);

	const value = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getSnapshot,
	);

	return selector ? value : editor;
}
