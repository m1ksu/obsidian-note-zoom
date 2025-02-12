import NoteZoomPlugin from "./main"
import { App, PluginSettingTab, Setting, Hotkey, Notice } from "obsidian"

export enum ZoomRememberOptions {
	None = "None",
	// Filename = "Filename",
	Properties = "Properties",
}

export interface NoteZoomPluginSettings {
	defaultZoom: number
	zoomRememberSetting: ZoomRememberOptions
	hideZoomProperty: boolean
	zoomPropertyName: string
}

export class DEFAULT_HOTKEYS {
	static ZoomIn: Hotkey = {
		key: "+",
		modifiers: ["Ctrl", "Shift"],
	}

	static ZoomOut: Hotkey = {
		key: "-",
		modifiers: ["Ctrl", "Shift"],
	}
}

export const DEFAULT_SETTINGS: Partial<NoteZoomPluginSettings> = {
	zoomRememberSetting: ZoomRememberOptions.Properties,
	hideZoomProperty: true,
	zoomPropertyName: "zoom",
}

export class NoteZoomSettingTab extends PluginSettingTab {
	plugin: NoteZoomPlugin
	hideZoomProperty: Setting

	constructor(app: App, plugin: NoteZoomPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		let { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName("Store zoom level in properties")
			.setDesc(
				"Choose whether or not the note's zoom level should be saved as a property within the note, so as to remember the zoom level across sessions."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.zoomRememberSetting == ZoomRememberOptions.Properties)
					.onChange(async (value) => {
						this.plugin.settings.zoomRememberSetting = value ? ZoomRememberOptions.Properties : ZoomRememberOptions.None
						await this.plugin.saveSettings()
					})
			})

		this.hideZoomProperty = new Setting(containerEl)
			.setName("Hide zoom property")
			.setDesc("Hide the \"zoom\" property, and the properties menu itself if it is its only property.")
			.addToggle((toggle) => {
				toggle
					.onChange(async (value) => {
						this.plugin.settings.hideZoomProperty = value
						this.plugin.propertyVisibilitySettingsChanged()
						await this.plugin.saveSettings()
					})
					.setValue(this.plugin.settings.hideZoomProperty)
			})

		// new Setting(containerEl)
		// 	.setName("Zoom property name")
		// 	.setDesc("Name of the property that is used to store the note's zoom amount.")
		// 	.addTextArea((textArea) => {
		// 		textArea
    //     .setValue(this.plugin.settings.zoomPropertyName ?? "zoom")
    //     .onChange(async (value) => {
		// 			this.plugin.settings.zoomPropertyName = value
		// 			this.plugin.propertyVisibilitySettingsChanged()
		// 			await this.plugin.saveSettings()
		// 		})
		// 	})

		new Setting(containerEl)
			.setName("Default zoom amount")
			.setDesc("Automatically zoom unzoomed notes to this multiplier, if they're not already zoomed in or out. The \"Reset zoom\" command uses this zoom value.")
			.addTextArea((textArea) => {
				textArea
        .setValue((this.plugin.settings.defaultZoom ?? 1).toString())
        .onChange(async (value) => {
					const newDefault = parseFloat(value) // Convert to number

					if (isNaN(newDefault)) {
						new Notice("Please enter a valid number", 1000)
						return // Stop here if not a valid number
					}

					this.plugin.settings.defaultZoom = newDefault
					await this.plugin.saveSettings()
				})
			})
	}
}
