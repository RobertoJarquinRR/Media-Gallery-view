import { App, PluginSettingTab } from 'obsidian';
import MyPlugin from './main.js';

export interface MyPluginSettings {}

export const DEFAULT_SETTINGS: MyPluginSettings = {};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
	}
}