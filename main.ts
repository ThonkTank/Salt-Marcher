/*
 * Salt Marcher – Plugin Entry (integriert)
 * - Lädt/merged Settings
 * - Konfiguriert Logger (inkl. Re-Init bei Settings-Updates)
 * - Registriert Settings-Tab
 * - Stellt Demo-Commands bereit (TemplateService & TileNoteService)
 * - Liefert ausführliche Debug-Ausgaben für robuste Fehlersuche
 */

import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type SaltSettings, withDefaults } from "./settings";
import { SaltSettingsTab } from "./settingsTab";
import { setLoggerConfig, createLogger } from "./logger";
import { HEX_VIEW_TYPE, HexViewView } from "./HexViewView";
import { EventBus, type EventMap } from "./EventBus";
import { Clock } from "./Clock";
import { createOrOpenTileNote } from "./templateService";
import { TileNoteService } from "./TileNoteService";
import { ChronicleService } from "./ChronicleService";
import { TravelProcessor } from "./TravelProcessor";
import { makeTerrainResolver } from "./RuleEngine";

export default class SaltMarcherPlugin extends Plugin {
  settings!: SaltSettings;

  // Bootstrap-Logger für ganz frühe Logs; wird nach setLoggerConfig() neu erstellt
  private log = createLogger("Core/Bootstrap");

  // Zentraler Service für Feature 3
  public tileNotes!: TileNoteService;

  // Eventing/Time
  public bus!: EventBus<EventMap>;
  public clock!: Clock;
  public chronicle!: ChronicleService;

  
  // Feature 6
  public bus!: EventBus<EventMap>;
  public clock!: Clock;

  public travel!: TravelProcessor;
// ────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  async onload() {
    this.addCommand({
      id: "salt-chronicle-set-from-active",
      name: "Chronicle: Aktive Datei als Session setzen",
      callback: async () => {
        try { await this.chronicle.setCurrentFromActiveFile(); } catch (err) { this.log.error("chronicle:setFromActive failed", { err }); }
      }
    });

      await this._validateAndPreparePaths();

    this.addCommand({
      id: "salt-chronicle-create-today",
      name: "Chronicle: Heutige Session erstellen & setzen",
      callback: async () => {
        try { await this.chronicle.createTodaySession(); } catch (err) { this.log.error("chronicle:createToday failed", { err }); }
      }
    });

    this.addCommand({
      id: "salt-travel-demo-road",
      name: "Reise (Demo): 3 Schritte (Straße) → Zeit anwenden",
      callback: async () => {
        try {
          const res = await this.travel.demoThreeStepsRoad();
          this.bus?.emit("route:computed", { totalMin: res.totalMin, segments: res.segments, traceId: "cmd:demo-road" });
          this.clock?.advanceByTravel(res.totalMin, "cmd:demo-road");
        } catch (err) {
          this.log.error("cmd:demo-road failed", { err });
        }
      }
    });

    this.addCommand({
      id: "salt-travel-demo-river",
      name: "Reise (Demo): 1 Schritt (Flussquerung) → Zeit anwenden",
      callback: async () => {
        try {
          const res = await this.travel.demoRiverCrossing();
          this.bus?.emit("route:computed", { totalMin: res.totalMin, segments: res.segments, traceId: "cmd:demo-river" });
          this.clock?.advanceByTravel(res.totalMin, "cmd:demo-river");
        } catch (err) {
          this.log.error("cmd:demo-river failed", { err });
        }
      }
    });

    this.addCommand({
      id: "salt-clock-plus-60",
      name: "Clock: +60 Minuten",
      callback: () => {
        try { this.clock.advanceBy(60, "cmd:+60"); } catch (err) { this.log.error("cmd:+60 failed", { err }); }
      }
    });

    this.addCommand({
      id: "salt-clock-now",
      name: "Clock: Setze auf Jetzt",
      callback: () => {
        try { this.clock.set(new Date().toISOString(), "cmd:setNow"); } catch (err) { this.log.error("cmd:setNow failed", { err }); }
      }
    });

    this.addCommand({
      id: "salt-hexview-open-demo",
      name: "HexView (Demo) in Setting-Panel öffnen",
      callback: () => {
      const pane = this.addStatusBarItem(); // oder container in Leaf/Modal
      pane.empty();
      pane.createEl("div", { attr: { id: "hexview-demo" } });
      const container = pane.querySelector("#hexview-demo") as HTMLElement;
  
      // Store + Logger (falls Logger defekt, fallback auf console)
      const store = new (require("./HexViewStore").HexViewStore)({
        hexSize: 30,
        region: this.settings.defaultRegion ?? null,
      });
      const logger = require("./logger").createLogger?.("Hex/View") ?? console;
  
      // TileNoteService
      const notes = this.tileNotes;
  
      // HexView
      const HexView = require("./HexView").HexView as any;
      const view = new HexView(container, store, logger, notes, { cols: 20, rows: 14, bg: "transparent" });
      // keine weitere Referenz nötig – Demo
        },
    });
    this.addCommand({
      id: "salt-demo-travel-route",
      name: "Demo – Reisedauer für Beispielroute (Debug-Logs)",
      callback: async () => {
        try {
          const tp = new TravelProcessor({
            hexWidthMiles: this.settings.travelHexWidthMiles,
            baseSpeedMph: this.settings.travelBaseSpeedMph,
            roadMod: this.settings.travelRoadMod,
            riverCrossingMin: this.settings.travelRiverCrossingMin,
            terrainResolver: makeTerrainResolver(this.app, this.tileNotes),
          });
    
          // P0: einfache Beispielroute (benachbart)
          const route = [
            { from: { q: 0, r: 0 }, to: { q: 1, r: 0 }, onRoad: true,  note: "Start auf Straße" },
            { from: { q: 1, r: 0 }, to: { q: 1, r: 1 }, needsCrossRiver: true, note: "Flussquerung" },
            { from: { q: 1, r: 1 }, to: { q: 2, r: 1 }, onRoad: false, note: "Terrain zählt" },
          ];
    
          const res = await tp.processRoute(route);
          this.log.info("Travel-Demo Ergebnis", res);
    
          // Optional: kurze Notice
          if (this.settings.logEnableNotice) {
            new Notice(`Reisezeit (Demo): ${res.totalMin} min, Segmente: ${res.segments.length}`);
          }
        } catch (e) {
          this.log.error("Travel-Demo Fehler", { error: String(e) });
          new Notice("Travel-Demo Fehler – siehe Konsole/Logs.", 8000);
        }
      },
    });
    
    // Sehr frühe Info (noch vor erfolgreichem Settings-Laden)
    this.log.debug("onload() start – beginne Settings zu laden …", {
      manifestVersion: this.manifest?.version,
    });

    // Settings laden/mergen (defensiv)
    try {
      await this.loadSettings();
      this.log.debug("Settings geladen & gemerged", {
      
        settingsKeys: Object.keys(this.settings ?? {}),
      });
// EventBus & Clock initialisieren
try {
  this.bus = new EventBus<EventMap>();
  this.log.debug("EventBus initialisiert", { listeners: this.bus.count() });

  this.clock = new Clock(this, this.bus, this.settings.clockStartISO ?? undefined);
  await this.clock.initFromStorage(this.settings.clockStartISO ?? undefined, Boolean(this.settings.clockAutoStartNow));
  this.log.info("Clock initialisiert", { now: this.clock.now() });

  // Demo-Listener: logge jeden hourlyTick
  this.bus.on("clock:hourlyTick", ({ tickISO, tickIndex }) => {
    this.log.debug("clock:hourlyTick", { tickISO, tickIndex });
  });
} catch (err) {
  this.log.error("EventBus/Clock konnte nicht initialisiert werden!", { err });
}

// ChronicleService initialisieren (hört auf route:applied)
try {
  this.chronicle = new ChronicleService(this.app, this as any, this.settings, this.bus, this.clock);
  this.chronicle.initListeners();
  this.log.info("Chronicle initialisiert");
} catch (err) {
  this.log.error("Chronicle konnte nicht initialisiert werden", { err });
}



    // Feature 5 (repaired in P0.1): TravelProcessor
    try {
      const terrainResolver = makeTerrainResolver(this.app, this.tileNotes);
      this.travel = new TravelProcessor(this.app, this.settings as any, terrainResolver, (p) => {
        this.bus?.emit("route:computed", { totalMin: p.totalMin, segments: p.segments, traceId: "travel" });
      });
      this.log.info("TravelProcessor initialisiert");
// Feature 4 (P0.1 Step 3): Eigene HexView registrieren
try {
  this.registerView(HEX_VIEW_TYPE, (leaf) => new HexViewView(leaf, this));
  this.log.info("HexView registriert", { type: HEX_VIEW_TYPE });

  // Command: HexView öffnen (rechte Leiste)
  this.addCommand({
    id: "salt-hexview-open",
    name: "Salt Marcher: HexView öffnen",
    callback: async () => {
      try {
        const leaf = this.app.workspace.getRightLeaf(false);
        await leaf.setViewState({ type: HEX_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
        this.log.info("HexView geöffnet (right leaf)");
      } catch (err) {
        this.log.error("HexView öffnen fehlgeschlagen", { err });
      }
    }
  });
} catch (err) {
  this.log.error("registerView fehlgeschlagen", { err });
/** Prüft/erstellt konfigurierten Hex-/Session-Ordner und warnt bei Problemen. */
private async _validateAndPreparePaths(): Promise<void> {
  try {
    const { hexFolder, sessionsFolder, defaultRegion } = this.settings;
    const created: string[] = [];
    const warnings: string[] = [];

    const ensureFolder = async (path: string, label: string) => {
      const abs = this.app.vault.getAbstractFileByPath(path);
      if (!abs) {
        try {
          await this.app.vault.createFolder(path);
          created.push(`${label}:${path}`);
          this.log.warn("Ordner nicht gefunden – neu angelegt", { label, path });
        } catch (err) {
          this.log.error("Ordner anlegen fehlgeschlagen", { label, path, err });
        }
      } else if (!(abs as any).children) {
        // existiert, ist aber keine Mappe
        warnings.push(`${label}:${path} ist keine Mappe`);
        this.log.warn("Pfad ist keine Mappe", { label, path });
      }
    };

    await ensureFolder(hexFolder, "hexFolder");
    await ensureFolder(sessionsFolder, "sessionsFolder");

    if (!defaultRegion || !defaultRegion.trim()) {
      this.settings.defaultRegion = "Default";
      warnings.push("defaultRegion war leer → auf 'Default' gesetzt");
    }

    if (created.length || warnings.length) {
      this.log.info("Path-Validation abgeschlossen", { created, warnings });
    } else {
      this.log.debug("Path-Validation ok");
    }
  } catch (err) {
    this.log.error("Path-Validation exception", { err });
  }
}

}

    } catch (err) {
      this.log.error("TravelProcessor konnte nicht initialisiert werden", { err });
    }

    } catch (err) {
      this.log.error("Fehler beim Laden der Settings – nutze DEFAULT_SETTINGS!", { err });
      this.settings = { ...DEFAULT_SETTINGS };
    }

    // Logger mit gelesenen (oder Fallback-) Settings initialisieren
    this._applyLoggerConfig("onload:initial");
    // Erst NACH setLoggerConfig() frischen Logger holen
    this.log = createLogger("Core");
    this.log.info("Plugin geladen – Settings & Logger aktiv", {
      version: this.manifest?.version,
      nodeEnv: (process as any)?.env?.NODE_ENV,
    });

    // Settings-Tab registrieren
    try {
      this.addSettingTab(new SaltSettingsTab(this.app, this));
      this.log.debug("Settings-Tab registriert");
    } catch (err) {
      this.log.error("Konnte Settings-Tab nicht registrieren", { err });
    }

    // Feature-3 Service initialisieren (nach Settings!)
    try {
      this.tileNotes = new TileNoteService(this.app, this.settings as any);
      this.log.debug("TileNoteService initialisiert", {
        hexFolder: this.settings.hexFolder,
        defaultRegion: this.settings.defaultRegion,
      });
    } catch (err) {
      this.log.error("TileNoteService konnte nicht initialisiert werden!", { err });
    }

    // Selbsttest-Logs
    this._selfTestLogs();

    // Commands registrieren
    this._registerCommands();

    this.log.info("onload() abgeschlossen");
  }

  \1
    try {
      this.app.workspace.detachLeavesOfType(HEX_VIEW_TYPE);
      this.log.info("HexView detached on unload");
    } catch (err) {
      this.log.warn("detachLeavesOfType failed", { err });
    }
\2\3 catch (err) {
      // Falls Logger-Konfig zu diesem Zeitpunkt defekt ist:
      console.log("[SaltMarcher] Plugin entladen (Logger nicht verfügbar?)", err);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Settings-Handling
  // ────────────────────────────────────────────────────────────────────────────

  private async loadSettings() {
  const started = performance.now();
  const loaded = await this.loadData(); // kann null/undefined sein
  this.settings = withDefaults(loaded ?? {});
  const duration = Math.round(performance.now() - started);
  this.log.debug("loadSettings(): abgeschlossen", {
    durationMs: duration,
    loadedNullish: loaded == null,
    folders: {
      hex: this.settings.hexFolder,
      sessions: this.settings.sessionsFolder,
    },
    defaultRegion: this.settings.defaultRegion,
  });
}

  async saveSettings() {
    const started = performance.now();
    try {
      await this.saveData(this.settings);
      const duration = Math.round(performance.now() - started);
      this.log.info("Settings gespeichert", { durationMs: duration });

      // Nach dem Speichern Logger live neu konfigurieren
      this._applyLoggerConfig("saveSettings");
      this.log.debug("Logger-Config nach saveSettings() neu angewendet");
    } catch (err) {
      this.log.error("Fehler beim Speichern der Settings", { err, settings: this.settings });
      throw err;
    }
  }

  /** Zentral: Wendet die Logger-Konfig aus den aktuellen Settings an. */
  private _applyLoggerConfig(reason: string) {
  try {
    setLoggerConfig({
      globalLevel: this.settings.logGlobalLevel,
      perNamespace: this.settings.logPerNamespace,
      enableConsole: this.settings.logEnableConsole,
      enableNotice: this.settings.logEnableNotice,
      ringBufferSize: this.settings.logRingBufferSize,
      maxContextChars: this.settings.logMaxContextChars,
    });
    // Logger nach Anwendung neu erstellen, damit Level/Namespaces greifen
    this.log = createLogger("Core");
    this.log.debug("Logger-Konfiguration angewendet & Logger re-initialisiert", {
      reason,
      globalLevel: this.settings.logGlobalLevel,
      enableConsole: this.settings.logEnableConsole,
      enableNotice: this.settings.logEnableNotice,
    });
  } catch (err) {
      // Harter Fehlerfall: Fallback zu console
      console.error("[SaltMarcher] setLoggerConfig() fehlgeschlagen", err, this.settings);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Commands
  // ────────────────────────────────────────────────────────────────────────────

  private _registerCommands() {
    try {
      // (A) Bestehendes Demo über TemplateService – Regression Guard
      this.addCommand({
        id: "salt-create-tile-0-0",
        name: "Demo: Erzeuge/Öffne Tile 0,0 (TemplateService)",
        callback: async () => {
          const t0 = performance.now();
          const region = this.settings?.defaultRegion || "Region";
          this.log.info("Demo-Command gestartet: createOrOpenTileNote(0,0)", { region });

          try {
            await createOrOpenTileNote(this.app, 0, 0, region, this.settings);
            const dt = Math.round(performance.now() - t0);
            this.log.info("Demo-Command OK (TemplateService)", { durationMs: dt });
          } catch (err) {
            const dt = Math.round(performance.now() - t0);
            this.log.error("Demo-Command FAIL (TemplateService)", { durationMs: dt, err });
          }
        },
      });

      // (B) Neues Feature-3-Command über TileNoteService – Zielpfad der Implementierung
      this.addCommand({
        id: "salt-open-tile-0-0-feature3",
        name: "Feature 3: Öffne/Erzeuge Tile 0,0 (TileNoteService)",
        callback: async () => {
          const t0 = performance.now();
          const region = this.settings?.defaultRegion || "Region";
          this.log.info("F3 Command gestartet: tileNotes.open(0,0)", { region });

          try {
            const ref = await this.tileNotes.open(0, 0, region);
            const dt = Math.round(performance.now() - t0);
            this.log.info("F3 Command OK (TileNoteService)", { durationMs: dt, ref });
          } catch (err) {
            const dt = Math.round(performance.now() - t0);
            this.log.error("F3 Command FAIL (TileNoteService)", { durationMs: dt, err });
          }
        },
      });

      this.log.debug("Commands registriert: salt-create-tile-0-0, salt-open-tile-0-0-feature3");
    } catch (err) {
      this.log.error("Fehler beim Registrieren von Commands", { err });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Debug / Selbsttest
  // ────────────────────────────────────────────────────────────────────────────

  private _selfTestLogs() {
    try {
      const testLogger = createLogger("SelfTest");
      testLogger.trace("TRACE-Probe: erscheint nur bei sehr niedrigem Loglevel.");
      testLogger.debug("DEBUG-Probe: Logger funktioniert, Detaildaten aktiv.", {
        env: (process as any)?.env?.NODE_ENV ?? "unknown",
      });
      testLogger.info("INFO-Probe: Basis-Info-Log – sichtbar bei INFO+.");
      testLogger.warn("WARN-Probe: Warnung – sollte immer sichtbar sein.");
      testLogger.error("ERROR-Probe: Beispiel-Fehlerobjekt", {
        exampleError: { code: "E_SELFTEST", hint: "Nur ein Test" },
      });
    } catch (err) {
      // Falls Logger komplett defekt ist, wenigstens die Konsole nutzen:
      console.warn("[SaltMarcher] SelfTest-Logs fehlgeschlagen", err);
    }
  }
}
