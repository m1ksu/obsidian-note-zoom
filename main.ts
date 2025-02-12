import { MarkdownView, View, Plugin, FrontMatterInfo, WorkspaceLeaf } from "obsidian"

import {
	NoteZoomPluginSettings,
	NoteZoomSettingTab,
	DEFAULT_SETTINGS,
	DEFAULT_HOTKEYS,
	ZoomRememberOptions,
} from "./settings"

import { ZoomProperty } from "./zoomProperty"

export enum ZoomMethod {
	Increment,
	Absolute,
}

export function newZoomEvent(zoomValue: number, zoomMethod: ZoomMethod): CustomEvent<[number, ZoomMethod]> {
	return new CustomEvent<[number, ZoomMethod]>("zoomChanged", { detail: [zoomValue, zoomMethod] })
}

export default class NoteZoomPlugin extends Plugin {
	settings: NoteZoomPluginSettings
	fileZooms: Record<string, number>
	viewsWithListeners: Map<View, (event: CustomEvent) => void>
	zoomProperties: ZoomProperty[]
	rootElement: HTMLElement
	// lastZoomTime: number 

	async onload() {
		await this.loadPluginData()
		// this.lastZoomTime = 0
		this.zoomProperties = []
		this.propertyVisibilitySettingsChanged()
		this.addSettingTab(new NoteZoomSettingTab(this.app, this))

		this.addCommand({
			id: "zoom-note-in",
			name: "Zoom in",
			callback: () => invokeZoomChange(1, this.latestView()),
		})

		this.addCommand({
			id: "zoom-note-out",
			name: "Zoom out",
			callback: () => invokeZoomChange(-1, this.latestView()),
		})

		this.addCommand({
			id: "reset-zoom",
			name: "Reset zoom",
			callback: () => invokeZoomChange(this.settings.defaultZoom, this.latestView(), ZoomMethod.Absolute)
		})

		this.app.workspace.onLayoutReady(() => {
			this.viewsWithListeners = new Map<View, (event: CustomEvent) => void>()
			// @ts-ignore
			this.rootElement = (this.app.workspace.containerEl.getRootNode() as HTMLElement).documentElement
			this.zoomEventListenersHandler()
			this.zoomPropertiesHandler()
		})
	}

	iterateMarkdownViews(fn: (value: WorkspaceLeaf) => void) {
		this.app.workspace
			.getLeavesOfType("markdown")
			.filter((leaf) => isMarkdownFile(leaf))
			.forEach(fn)
	}

	addNoteEventListeners(
		openNoteIterator: (leaf: WorkspaceLeaf) => void,
		activeChanged: () => void,
		layoutChanged: () => void
	) {
		this.iterateMarkdownViews(openNoteIterator)
		this.registerEvent(this.app.workspace.on("active-leaf-change", activeChanged))
		this.registerEvent(this.app.workspace.on("layout-change", layoutChanged))
	}

	propertyVisibilitySettingsChanged() {
		document.documentElement.style.setProperty("--metadata-visibility", this.settings.hideZoomProperty ? "none" : "inherit")
	}

	addZoomEventListenerToView(view: View, listener: (event: CustomEvent) => void) {
		view.containerEl.addEventListener("zoomChanged", listener)
		this.viewsWithListeners.set(view, listener)
	}

	zoomEventListenersHandler() {
		const openNoteIterator = (leaf: WorkspaceLeaf) => {
			this.addZoomEventListenerToView(leaf.view, (event: CustomEvent) =>
				this.changeViewZoom(event.detail[0], leaf.view, event.detail[1])
			)
		}

		// Handle changing of active note
		const activeChanged = () => {
			setTimeout(() => {}, 0)

			const latestView = this.latestView()
			if (latestView && isMarkdownFile(latestView) && !this.viewsWithListeners.has(latestView!)) {
				this.addZoomEventListenerToView(latestView, (event: CustomEvent) =>
					this.changeViewZoom(event.detail[0], latestView, event.detail[1])
				)
			}
		}

		// Handle possible closing of note
		const layoutChanged = () => {
			setTimeout(() => {}, 0)

			let openViews: View[] = []
			this.iterateMarkdownViews((workspaceLeaf) => {
				if (workspaceLeaf.view) openViews.push(workspaceLeaf.view)
			})

			this.viewsWithListeners.forEach((listener, view, map) => {
				if (!openViews.contains(view)) {
					view.containerEl.removeEventListener("zoom", listener)
					this.viewsWithListeners.delete(view)
				}
			})
		}

		this.addNoteEventListeners(openNoteIterator, activeChanged, layoutChanged)
	}

	zoomPropertiesHandler() {
		const openNoteIterator = (leaf: WorkspaceLeaf) => {
			if (isMarkdownFile(leaf)) this.zoomProperties.push(new ZoomProperty(leaf.view as MarkdownView, this))
		}

		// Handle changing of active note
		const activeChanged = () => {
			setTimeout(() => {}, 0)
			const activeView = this.latestView() as MarkdownView | undefined

			this.zoomProperties.forEach((zoomProperty) => zoomProperty.attemptInitialization())

			if (
				activeView &&
				isMarkdownFile(activeView) &&
				!this.zoomProperties.some((zoomProperty) => zoomProperty.markdownView === activeView)
			) {
				this.zoomProperties.push(new ZoomProperty(activeView, this))
			}
		}

		// Handle possible closing of note
		const layoutChanged = () => {
			setTimeout(() => {}, 0)

			let openViews: MarkdownView[] = []
			this.iterateMarkdownViews((markdownView) => {
				if (markdownView.view) openViews.push(markdownView.view as MarkdownView)
			})

			const zoomPropertyViewMap = new Map()
			this.zoomProperties.forEach((zoomProperty) => {
				zoomPropertyViewMap.set(zoomProperty, zoomProperty.markdownView)
			})

			zoomPropertyViewMap.forEach((zoomProperty, zoomPropertyView) => {
				if (!openViews.contains(zoomPropertyView)) this.zoomProperties.remove(zoomProperty)
			})
		}

		this.addNoteEventListeners(openNoteIterator, activeChanged, layoutChanged)
	}

	latestView(): View | undefined {
		return this.app.workspace.getMostRecentLeaf()?.view
	}

	async onunload() {
		// this.zoomProperties.forEach((zoomProperty) => zoomProperty.unload())
		this.viewsWithListeners.forEach((listener, view, map) => {
			view.containerEl.removeEventListener("zoom", listener)
		})
	}

	async loadPluginData() {
		const data = await this.loadData()
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {})
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	changeViewZoom(zoomAmount: number, view: View | undefined, method: ZoomMethod = ZoomMethod.Increment) {
		if (!view) return
		const style = view.containerEl.style
		const oldZoom = parseFloat(style.getPropertyValue("--note-zoom-level")) || 1
		const newZoom = calculateNewZoomLevel(oldZoom, zoomAmount, method)
		style.setProperty("--note-zoom-level", newZoom.toString())
		// this.lastZoomTime = Date.now()

		const scroller = view.containerEl.querySelector(".cm-vimMode")
		if (scroller) {
			const cursor = scroller.querySelector(".cm-fat-cursor")
			if (cursor) {
				const cursorFontSize = (cursor as HTMLElement).style.getPropertyValue("font-size")
				if (cursorFontSize) {
					const newFontSize = parseFloat(cursorFontSize.substring(0, cursorFontSize.length - 2)) * newZoom
					style.setProperty("--note-zoom-level-fontsize", newFontSize.toString() + "px")
				}
			}
		}

		this.zoomProperties
			.filter((zoomProperty) => zoomProperty.markdownView == view)
			.first()!
			.zoomChanged(newZoom)
	}
}

function calculateNewZoomLevel(zoom: number, zoomAmount: number, method: ZoomMethod = ZoomMethod.Increment): number {
	if (zoomAmount == 0) return 1
	if (method == ZoomMethod.Absolute) return Math.clamp(Math.round(zoomAmount * 10) / 10, 0, 1000)
	else return Math.clamp(Math.round((zoom + zoomAmount / 10) * 10) / 10, 0, 1000)
}

function isMarkdownFile(file: View | WorkspaceLeaf) {
	if (file instanceof View) return file.getViewType() === "markdown"
	else return file.view.getViewType() === "markdown"
}

export function invokeZoomChange(value: number, view: View | undefined, method: ZoomMethod = ZoomMethod.Increment) {
	view?.containerEl.dispatchEvent(newZoomEvent(value, method))
}
