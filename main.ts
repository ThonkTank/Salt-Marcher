import { App, ItemView, Plugin, WorkspaceLeaf } from "obsidian";

/** View-Type Konstanten */
export const VIEW_TYPE_HEXMAP = "salt-marcher-hexmap";

/**
 * Minimale HexMapView – nur für Schritt 2.
 * In Schritt 3 ziehen wir das in /src/views/HexMapView.ts um und bauen das Grid aus.
 */
class HexMapView extends ItemView {
	private rootEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		console.debug("[Salt Marcher][HexMapView][ctor] View-Konstruktor aufgerufen (Leaf ID vorhanden).");
	}

	getViewType(): string {
		return VIEW_TYPE_HEXMAP;
	}

	getDisplayText(): string {
		return "Salt Marcher HexMap";
	}

	getIcon(): string {
		// Optional: eigenes Icon später. Vorerst: "layout-grid" ist gut sichtbar.
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		try {
			console.debug("[Salt Marcher][HexMapView][onOpen] Öffne View und rendere leeres Panel…");
			this.rootEl = this.containerEl.createDiv({ cls: "salt-marcher-hexmap-root" });
			const header = this.rootEl.createEl("h3", { text: "Salt Marcher – HexMap (Platzhalter)" });
			header.style.margin = "8px 12px";

			const info = this.rootEl.createEl("div", { text: "Schritt 2: Leeres Panel erfolgreich geladen. (Kommando: „Salt Marcher: Open HexMap“)" });
			info.style.margin = "0 12px 12px";
			info.style.opacity = "0.8";

			console.debug("[Salt Marcher][HexMapView][onOpen] Panel gerendert.");
		} catch (err) {
			console.error("[Salt Marcher][HexMapView][onOpen][FEHLER] View konnte nicht korrekt geöffnet werden:", err);
		}
	}

	async onClose(): Promise<void> {
		try {
			console.debug("[Salt Marcher][HexMapView][onClose] Schließe View, bereinige DOM…");
			if (this.rootEl) {
				this.rootEl.detach();
				this.rootEl = null;
			}
			console.debug("[Salt Marcher][HexMapView][onClose] Bereinigung abgeschlossen.");
		} catch (err) {
			console.error("[Salt Marcher][HexMapView][onClose][FEHLER] Beim Schließen ist ein Fehler aufgetreten:", err);
		}
	}
}

export default class SaltMarcherPlugin extends Plugin {
	async onload() {
		console.debug("[Salt Marcher][Plugin][onload] Plugin wird geladen…");

		// 1) View registrieren
		this.registerView(
			VIEW_TYPE_HEXMAP,
			(leaf) => {
				console.debug("[Salt Marcher][Plugin] Registriere View-Instanz für Leaf…");
				return new HexMapView(leaf);
			}
		);

		// 2) Command zum Öffnen der View
		this.addCommand({
			id: "salt-marcher-open-hexmap",
			name: "Salt Marcher: Open HexMap",
			callback: async () => {
				console.debug("[Salt Marcher][Command] „Open HexMap“ ausgelöst – aktiviere View…");
				try {
					await this.activateHexMapView();
					console.debug("[Salt Marcher][Command] HexMap wurde (oder war bereits) sichtbar.");
				} catch (err) {
					console.error("[Salt Marcher][Command][FEHLER] Konnte HexMap nicht aktivieren:", err);
				}
			},
		});

		console.debug("[Salt Marcher][Plugin][onload] Plugin geladen. Command & View stehen bereit.");
	}

	onunload() {
		console.debug("[Salt Marcher][Plugin][onunload] Plugin wird entladen – entferne HexMap-Leaves…");
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HEXMAP).forEach((leaf) => {
			try {
				leaf.detach();
				console.debug("[Salt Marcher][Plugin][onunload] Leaf erfolgreich detached.");
			} catch (err) {
				console.error("[Salt Marcher][Plugin][onunload][FEHLER] Beim Detachen eines Leafs:", err);
			}
		});
		console.debug("[Salt Marcher][Plugin][onunload] Entladen abgeschlossen.");
	}

	/** Öffnet (oder fokussiert) die HexMap-View rechts. */
	private async activateHexMapView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_HEXMAP);

		// Falls bereits offen: nur zeigen
		if (existing.length > 0) {
			console.debug("[Salt Marcher][activateHexMapView] View existiert bereits – reveal Leaf.");
			workspace.revealLeaf(existing[0]);
			return;
		}

		console.debug("[Salt Marcher][activateHexMapView] Erstelle neues Leaf für HexMap…");

		// Versuche rechte Seitenleiste, andernfalls neues Leaf
		let leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			console.warn("[Salt Marcher][activateHexMapView] Konnte rechtes Leaf nicht holen – erzeuge neues generisches Leaf.");
			leaf = workspace.getLeaf(true);
		}

		try {
			await leaf.setViewState({ type: VIEW_TYPE_HEXMAP, active: true });
			workspace.revealLeaf(leaf);
			console.debug("[Salt Marcher][activateHexMapView] ViewState gesetzt & Leaf sichtbar gemacht.");
		} catch (err) {
			console.error("[Salt Marcher][activateHexMapView][FEHLER] Konnte ViewState nicht setzen:", err);
			throw err;
		}
	}
}

