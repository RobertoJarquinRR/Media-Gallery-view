import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
	TFile,
	App,
	normalizePath,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	MediaGallerySetting,
	SettingTab,
} from './settings.js';

// Remember to rename these classes and interfaces!

export default class MediaGallery extends Plugin {
	settings!: MediaGallerySetting;
	
	async onload() {
		
		
		this.registerMarkdownCodeBlockProcessor("MediaGallery", (Source, Container, Context)=>{
			let GalleryPath = '';
			const Div = Container.createDiv();

			const Path = Source.split(",").map( P => P.trim()).find( P => P.startsWith("Path:"));

			if (Path){
				GalleryPath = Path.replace("Path:" ,"").trim();
			}
			else
			{
				const Error = Div.createEl("p", {text: "Write a path"})
			}
			
			const VideoExtensions = ['mp4', 'webm', 'ogv', 'mov']
			let files : TFile[];

			if(GalleryPath){
				files = this.app.vault.getFiles().filter( file => file.path.startsWith(GalleryPath)) 
				const VideoFiles = files.filter(video => VideoExtensions.includes(video.extension))
					VideoFiles.forEach(video => {
				const videocart = Div.createEl('p',{text: video.basename})
			})
			}
			else
				{
				const error = Div.createEl('p', {text:"Path no found"})
			}

			


		
			
			

		})

		this.addSettingTab(new SettingTab(this.app, this)); 

		
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},

			DEFAULT_SETTINGS,

			(await this.loadData())  as Partial<MediaGallerySetting>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function GetPath(Source: string): string {
	if (Source === undefined) {
		return 'Write a path';
	}
	const result = Source.split(',')
		.map((p) => p.trim().toLocaleLowerCase())
		.find((p) => p.startsWith('path:'))
		?.replace('path:', '')
		.trim();

	return normalizePath(result ?? 'Write a path');
}
