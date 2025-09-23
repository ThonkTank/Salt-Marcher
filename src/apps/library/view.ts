// src/apps/library/view.ts
import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { ensureCreatureDir, listCreatureFiles, watchCreatureDir } from "./core/creature-files";
import { enhanceSelectToSearch } from "../../ui/search-dropdown";
import { ensureTerrainFile, loadTerrains, saveTerrains, watchTerrains, TERRAIN_FILE } from "../../core/terrain-store";
import { ensureRegionsFile, loadRegions, saveRegions, watchRegions, REGIONS_FILE, type Region } from "../../core/regions-store";
import { ensureSpellDir, listSpellFiles, watchSpellDir, createSpellFile } from "./core/spell-files";
import { CreateSpellModal, openCreatureCreator } from "./create";

export const VIEW_LIBRARY = "salt-library";

type Mode = "creatures" | "spells" | "terrains" | "regions";

export class LibraryView extends ItemView {
    private mode: Mode = "creatures";
    private cleanups: Array<() => void> = [];
    private unwatch?: () => void;
    private query = "";

    // data per mode
    private creatureFiles: TFile[] = [];
    private terrains: Record<string, { color: string; speed: number }> = {};
    private spellFiles: TFile[] = [];
    private regions: Region[] = [];

    getViewType() { return VIEW_LIBRARY; }
    getDisplayText() { return "Library"; }
    getIcon() { return "library" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-library");
        await ensureCreatureDir(this.app);
        await ensureTerrainFile(this.app);
        await ensureSpellDir(this.app);
        await ensureRegionsFile(this.app);
        await this.reloadAll();
        this.render();
        this.attachWatcher();
    }

    async onClose() {
        this.unwatch?.();
        this.cleanups.forEach(fn => { try { fn(); } catch {} });
        this.cleanups = [];
        this.contentEl.removeClass("sm-library");
    }

    private attachWatcher() {
        this.unwatch?.();
        const off: Array<() => void> = [];
        off.push(watchCreatureDir(this.app, () => this.onSourceChanged("creatures")));
        off.push(watchSpellDir(this.app, () => this.onSourceChanged("spells")));
        off.push(watchTerrains(this.app, () => this.onSourceChanged("terrains")));
        off.push(watchRegions(this.app, () => this.onSourceChanged("regions")));
        this.unwatch = () => off.forEach(fn => fn());
    }

    private async onSourceChanged(which: Mode) {
        if (which === "creatures") this.creatureFiles = await listCreatureFiles(this.app);
        if (which === "spells") this.spellFiles = await listSpellFiles(this.app);
        if (which === "terrains") this.terrains = await loadTerrains(this.app);
        if (which === "regions") this.regions = await loadRegions(this.app);
        this.renderList();
    }

    private async reloadAll() {
        [this.creatureFiles, this.spellFiles, this.terrains, this.regions] = await Promise.all([
            listCreatureFiles(this.app),
            listSpellFiles(this.app),
            loadTerrains(this.app),
            loadRegions(this.app),
        ]);
    }

    private render() {
        const root = this.contentEl; root.empty();
        root.createEl("h2", { text: "Library" });

        // Mode header
        const header = root.createDiv({ cls: "sm-lib-header" });
        const mkBtn = (label: string, m: Mode) => {
            const b = header.createEl("button", { text: label });
            const update = () => b.classList.toggle("is-active", this.mode === m);
            update();
            b.onclick = () => { this.mode = m; updateAll(); };
            return b;
        };
        mkBtn("Creatures", "creatures");
        mkBtn("Spells", "spells");
        mkBtn("Terrains", "terrains");
        mkBtn("Regions", "regions");

        // Search + Create
        const bar = root.createDiv({ cls: "sm-cc-searchbar" });
        const search = bar.createEl("input", { attr: { type: "text", placeholder: "Suche oder Name eingeben…" } }) as HTMLInputElement;
        search.value = this.query;
        search.oninput = () => { this.query = search.value; this.renderList(); };
        const createBtn = bar.createEl("button", { text: "Erstellen" });
        createBtn.onclick = () => this.onCreate(search.value.trim());

        // Target source info
        const desc = root.createDiv({ cls: "desc" });
        const updateDesc = () => {
            desc.setText(
                this.mode === "creatures" ? "Quelle: SaltMarcher/Creatures/" :
                this.mode === "spells" ? "Quelle: SaltMarcher/Spells/" :
                this.mode === "terrains" ? `Quelle: ${TERRAIN_FILE}` :
                `Quelle: ${REGIONS_FILE}`
            );
        };
        updateDesc();

        // List container
        root.createDiv({ cls: "sm-cc-list" });

        const updateAll = () => { updateDesc(); this.renderList(); header.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', (b as HTMLButtonElement).innerText.toLowerCase().startsWith(this.mode.slice(0,3)))); };
        this.renderList();
    }

    private renderList() {
        const root = this.contentEl;
        const list = root.querySelector(".sm-cc-list") as HTMLElement;
        if (!list) return;
        list.empty();
        const q = (this.query || "").toLowerCase();
        const score = (name: string) => this.scoreName(name.toLowerCase(), q);

        if (this.mode === "creatures") {
            const items = this.creatureFiles.map(f => ({ name: f.basename, f, s: score(f.basename) }))
                .filter(x => q ? x.s > -Infinity : true)
                .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
            for (const it of items) {
                const row = list.createDiv({ cls: "sm-cc-item" });
                row.createDiv({ cls: "sm-cc-item__name", text: it.name });
                const openBtn = row.createEl("button", { text: "Öffnen" });
                openBtn.onclick = async () => this.app.workspace.openLinkText(it.f.path, it.f.path, true);
            }
            return;
        }

        if (this.mode === "spells") {
            const items = this.spellFiles.map(f => ({ name: f.basename, f, s: score(f.basename) }))
                .filter(x => q ? x.s > -Infinity : true)
                .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
            for (const it of items) {
                const row = list.createDiv({ cls: "sm-cc-item" });
                row.createDiv({ cls: "sm-cc-item__name", text: it.name });
                const openBtn = row.createEl("button", { text: "Öffnen" });
                openBtn.onclick = async () => this.app.workspace.openLinkText(it.f.path, it.f.path, true);
            }
            return;
        }

        if (this.mode === "terrains") {
            // include empty terrain always at top
            const names = Object.keys(this.terrains || {});
            const order = ["", ...names.filter(n => n !== "")];
            const items = order
                .map(name => ({ name, s: score(name || "") }))
                .filter(x => x.name === "" || (q ? x.s > -Infinity : true))
                .sort((a, b) => a.name === "" ? -1 : b.name === "" ? 1 : (b.s - a.s || a.name.localeCompare(b.name)));

            for (const it of items) {
                const row = list.createDiv({ cls: "sm-cc-item" });
                const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } }) as HTMLInputElement;
                nameInp.value = it.name;
                const colorInp = row.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
                const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } }) as HTMLInputElement;
                const delBtn = row.createEl("button", { text: "🗑" });

                const v = this.terrains[it.name] || { color: "transparent", speed: 1 };
                colorInp.value = /^#([0-9a-f]{6})$/i.test(v.color) ? v.color : "#999999";
                speedInp.value = String(Number.isFinite(v.speed) ? v.speed : 1);

                const commit = () => this.commitTerrains();
                const upsert = () => {
                    const k = nameInp.value;
                    const color = colorInp.value;
                    const speed = parseFloat(speedInp.value) || 1;
                    this.upsertTerrain(it.name, k, color, speed);
                };
                nameInp.oninput = upsert;
                colorInp.oninput = upsert;
                speedInp.oninput = upsert;
                delBtn.onclick = () => this.removeTerrain(nameInp.value);
            }
            return;
        }

        // regions
        const entries = this.regions.map((r, i) => ({ ...r, _i: i }))
            .filter(r => (r.name || "").trim())
            .map(r => ({ r, s: score(r.name) }))
            .filter(x => q ? x.s > -Infinity : true)
            .sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name));
        for (const it of entries) {
            const row = list.createDiv({ cls: "sm-cc-item" });
            const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } }) as HTMLInputElement;
            nameInp.value = it.r.name;
            const terrSel = row.createEl("select") as HTMLSelectElement;
            enhanceSelectToSearch(terrSel, 'Such-dropdown…');
            const terrNames = Object.keys(this.terrains || {});
            for (const t of terrNames) {
                const opt = terrSel.createEl("option", { text: t || "(leer)", value: t });
                if (t === it.r.terrain) opt.selected = true;
            }
            const encInp = row.createEl("input", { attr: { type: "number", min: "1", step: "1", placeholder: "Encounter 1/n" } }) as HTMLInputElement;
            encInp.value = it.r.encounterOdds && it.r.encounterOdds > 0 ? String(it.r.encounterOdds) : "";
            const delBtn = row.createEl("button", { text: "🗑" });

            const update = () => {
                const n = parseInt(encInp.value, 10);
                const odds = Number.isFinite(n) && n > 0 ? n : undefined;
                this.upsertRegion(it.r._i as number, nameInp.value, terrSel.value, odds);
            };
            nameInp.oninput = update;
            terrSel.onchange = update;
            encInp.oninput = update;
            delBtn.onclick = () => this.removeRegion(it.r._i as number);
        }
    }

    private async onCreate(name: string) {
        if (this.mode === "creatures") {
            openCreatureCreator(this.app, {
                initial: name ? { name } : undefined,
                onSaved: async ({ file }) => {
                    await this.onSourceChanged("creatures");
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                },
            });
            return;
        }
        if (this.mode === "spells") {
            new CreateSpellModal(this.app, name, async (data) => {
                const f = await createSpellFile(this.app, data);
                await this.onSourceChanged("spells");
                await this.app.workspace.openLinkText(f.path, f.path, true, { state: { mode: "source" } });
            }).open();
            return;
        }
        if (!name) return;
        if (this.mode === "terrains") {
            const map = { ...this.terrains };
            if (!map[name]) map[name] = { color: "#888888", speed: 1 };
            await saveTerrains(this.app, map);
            this.terrains = await loadTerrains(this.app);
            this.renderList();
            return;
        }
        // regions
        const exists = this.regions.some(r => (r.name || "").toLowerCase() === name.toLowerCase());
        if (!exists) {
            const next = [...this.regions, { name, terrain: "" }];
            await saveRegions(this.app, next);
            this.regions = await loadRegions(this.app);
            this.renderList();
        }
    }

    private scoreName(name: string, q: string): number {
        if (!q) return 0.0001;
        if (name === q) return 1000;
        if (name.startsWith(q)) return 900 - (name.length - q.length);
        const idx = name.indexOf(q);
        if (idx >= 0) return 700 - idx;
        const tokenIdx = name.split(/\s+|[-_]/).findIndex(t => t.startsWith(q));
        if (tokenIdx >= 0) return 600 - tokenIdx * 5;
        return -Infinity;
    }

    // --- Terrains helpers ---
    private async commitTerrains() {
        await saveTerrains(this.app, this.terrains);
        // reload to normalize ordering and ensure empty terrain key present
        this.terrains = await loadTerrains(this.app);
    }
    private upsertTerrain(oldKey: string, newKey: string, color: string, speed: number) {
        if (!Number.isFinite(speed as any)) speed = 1;
        const next = { ...this.terrains };
        if (oldKey !== newKey) delete next[oldKey];
        if (newKey === "") next[""] = { color: "transparent", speed: 1 };
        else next[newKey] = { color, speed };
        this.terrains = next;
        void this.commitTerrains();
    }
    private removeTerrain(key: string) {
        if (key === "") return;
        const next = { ...this.terrains }; delete next[key]; this.terrains = next;
        void this.commitTerrains(); this.renderList();
    }

    // --- Regions helpers ---
    private async commitRegions() {
        await saveRegions(this.app, this.regions);
    }
    private upsertRegion(idx: number, name: string, terrain: string, encounterOdds?: number) {
        if (!this.regions[idx]) return;
        this.regions[idx] = { name, terrain, encounterOdds } as Region;
        void this.commitRegions();
    }
    private removeRegion(idx: number) {
        if (!this.regions[idx]) return;
        this.regions.splice(idx, 1);
        void this.commitRegions();
        this.renderList();
    }
}
