import { App, Platform, TFile } from 'obsidian';

interface AppWithOpenDefault extends App {
	openWithDefaultApp?: (path: string) => unknown;
}

export function openFileInObsidian(app: App, file: TFile): void {
	void app.workspace.getLeaf('tab').openFile(file);
}

export function openFileNative(app: App, file: TFile): void {
	if (Platform.isDesktopApp) {
		const internal = app as AppWithOpenDefault;
		if (typeof internal.openWithDefaultApp === 'function') {
			void internal.openWithDefaultApp(file.path);
			return;
		}
	}

	void app.workspace.openLinkText(file.path, '', true);
}
