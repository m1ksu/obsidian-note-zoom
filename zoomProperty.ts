import { CachedMetadata, FrontMatterCache, View, MarkdownView, TFile, getFrontMatterInfo } from "obsidian"
import { NoteZoomPluginSettings } from "./settings"
import NoteZoomPlugin, { invokeZoomChange, ZoomMethod } from "./main"

export class ZoomProperty {
	markdownView: MarkdownView
	metadataContainerElement: HTMLElement
	plugin: NoteZoomPlugin
	initialized: boolean = false
	propertyHiderStyle: HTMLElement | null | undefined

	zoomPropertyName() {
		return this.plugin.settings.zoomPropertyName
	}

	constructor(markdownView: MarkdownView, plugin: NoteZoomPlugin) {
		this.markdownView = markdownView
		this.plugin = plugin
		this.attemptInitialization()
		if (!this.initialized) this.waitForMetadataContainer()
	}

	async attemptInitialization() {
		if (this.initialized) return

		this.initialized = true
		setTimeout(() => {}, 0)

		this.plugin.registerEvent(
			this.markdownView.app.metadataCache.on("changed", async (file: TFile, data: string, cache: CachedMetadata) => {
				// if (Date.now() < this.plugin.lastZoomTime + 1000) return
				if (file == this.markdownView.file && cache.frontmatter?.hasOwnProperty(this.zoomPropertyName())) {
					const zoom = cache.frontmatter[this.zoomPropertyName()]

					if (zoom != parseFloat(this.markdownView.containerEl.style.getPropertyValue("--note-zoom-level")))
						invokeZoomChange(zoom, this.markdownView, ZoomMethod.Absolute)
				}
			})
		)

		const existingZoom = await this.getZoomFromFrontmatter()
		if (existingZoom) invokeZoomChange(existingZoom, this.markdownView, ZoomMethod.Absolute)
	}

	async getZoomFromFrontmatter(): Promise<number | null> {
		let zoomLevel: number | null = null
		await processFrontMatter(this.markdownView, (frontmatter: Record<any, any>) => {
			if (frontmatter?.hasOwnProperty(this.zoomPropertyName())) zoomLevel = frontmatter[this.zoomPropertyName()]
		})
		return zoomLevel
	}

	zoomChanged(newZoom: number) {
		processFrontMatter(this.markdownView, (frontMatter) => {
			if (newZoom == 1 && frontMatter?.hasOwnProperty(this.zoomPropertyName()))
				delete frontMatter[this.zoomPropertyName()]
			else if (frontMatter) frontMatter[this.zoomPropertyName()] = newZoom
		})
	}

	waitForMetadataContainer() {
		this.addMutationObserverFunction((mutations, observer) => {
			mutations.forEach((mutation) => {
				if (mutation.type === "childList") {
					mutation.addedNodes.forEach((addedNode: Node) => {
						if (addedNode instanceof Element && addedNode.matches(".metadata-container")) {
							observer.disconnect()
							this.attemptInitialization()
							return
						}
					})
				}
			})
		}, this.markdownView.containerEl)
	}

	async addMutationObserverFunction(
		fn: (mutations: MutationRecord[], observer: MutationObserver) => void,
		element: Node,
		observerOptions: MutationObserverInit = { attributes: true }
	) {
		const observer = new MutationObserver((mutations) => fn(mutations, observer))
		observer.observe(element, observerOptions)
		this.markdownView.registerEvent({
			detach: () => observer.disconnect(),
		})
	}
}

async function processFrontMatter(markdownView: MarkdownView, fn: (frontMatter: Record<any, any>) => void) {
	if (!markdownView.file) return
	await markdownView.app.fileManager.processFrontMatter(markdownView.file!, (frontMatter: Record<any, any>) => {
		fn(frontMatter)
	})
}
