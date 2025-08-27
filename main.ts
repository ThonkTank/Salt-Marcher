/*
 * Salt Marcher – Plugin Entry (integriert)
 * - Lädt/merged Settings
 * - Konfiguriert Logger (inkl. Re-Init bei Settings-Updates)
 * - Registriert Settings-Tab
 * - Stellt Demo-Command bereit (createOrOpenTileNote)
 * - Liefert ausführliche Debug-Ausgaben für robuste Fehlersuche
 */

import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type SaltSettings } from "./settings";
import { SaltSettingsTab } from "./settingsTab";
import { setLoggerConfig, createLogger } from "./logger";
import { createOrOpenTileNote } from "./templateService";
import { TileNoteService } from "./TileNoteService";

// main.ts (Ausschnitt – oben bei den Imports ergänzen)
import { TileNoteService } from "./TileNoteService";

// ... in der Plugin-Klasse:
export default class SaltMarcherPlugin extends Plugin {
  settings: SaltSettings;
  private log = createLogger("Core/Bootstrap");

  // ➕ NEU: zentral verfügbar für Klick-Handler/Commands
  tileNotes!: TileNoteService;

  async onload() {
    // ... (unverändert, Settings laden)

    // ➕ NEU: Service initialisieren (nach Settings!)
    this.tileNotes = new TileNoteService(this.app, this.settings);
    this.log.debug("TileNoteService initialisiert", {
      hexFolder: this.settings.hexFolder,
      defaultRegion: this.settings.defaultRegion,
    });

    // ... (SettingsTab registrieren, SelfTest etc.)

    // ➕ NEU: Test-Command für Feature 3
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
          this.log.info("F3 Command OK", { durationMs: dt, ref });
        } catch (err) {
          const dt = Math.round(performance.now() - t0);
          this.log.error("F3 Command FAIL", { durationMs: dt, err });
        }
      },
    });

    // ...
  }

  // ...
}

export default class SaltMarcherPlugin extends Plugin {
  settings: SaltSettings;
  // Hinweis: Logger erst nach setLoggerConfig() initialisieren
  private log = createLogger("Core/Bootstrap");

  async onload() {
    // Sehr frühe Info (noch vor erfolgreichem Settings-Laden)
    this.log.debug("onload() start – beginne Settings zu laden …", {
      manifestVersion: this.manifest?.version,
    });

    try {
      await this.loadSettings();
      this.log.debug("Settings geladen & gemerged", {
        settingsKeys: Object.keys(this.settings ?? {}),
      });
    } catch (err) {
      this.log.error("Fehler beim Laden der Settings – nutze DEFAULT_SETTINGS!", {
        err,
      });
      // Fallback, damit Plugin trotzdem läuft
      this.settings = { ...DEFAULT_SETTINGS };
    }

    // Logger anhand (ggf. gefallbackter) Settings konfigurieren
    this._applyLoggerConfig("onload:initial");

    // Erst NACH setLoggerConfig() einen frischen Core-Logger anlegen
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

    // Selbsttest: unterschiedliche Log-Levels testen
    this._selfTestLogs();

    // Demo-Command registrieren
    this._registerDemoCommands();

    this.log.info("onload() abgeschlossen");
  }

  onunload() {
    // Hier KEINE async-Operationen erzwingen – nur sauber loggen
    try {
      this.log.info("Plugin wird entladen");
    } catch (err) {
      // Falls Logger-Konfig zu diesem Zeitpunkt defekt ist:
      console.log("[SaltMarcher] Plugin entladen (Logger nicht verfügbar?)", err);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Settings-Handling
  // ────────────────────────────────────────────────────────────────────────────

  async loadSettings() {
    const started = performance.now();
    const loaded = await this.loadData();
    // Defensive Merge (loaded kann null/undefined sein)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
    const duration = Math.round(performance.now() - started);
    this.log.debug("loadSettings(): abgeschlossen", {
      durationMs: duration,
      loadedNullish: loaded == null,
    });
  }

  async saveSettings() {
    const started = performance.now();
    try {
      await this.saveData(this.settings);
      const duration = Math.round(performance.now() - started);
      this.log.info("Settings gespeichert", { durationMs: duration });

      // Nach dem Speichern ggf. Logger live neu konfigurieren
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
      // Früh loggen – kann noch mit altem Logger sein, ist aber okay
      this.log.debug("Logger-Konfiguration angewendet", {
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

  private _registerDemoCommands() {
    try {
      this.addCommand({
        id: "salt-create-tile-0-0",
        name: "Demo: Erzeuge Tile 0,0 in Default-Region",
        callback: async () => {
          const t0 = performance.now();
          const region = this.settings?.defaultRegion || "Region";
          this.log.info("Demo-Command gestartet: createOrOpenTileNote(0,0)", { region });

          try {
            await createOrOpenTileNote(this.app, 0, 0, region, this.settings);
            const dt = Math.round(performance.now() - t0);
            this.log.info("Demo-Command erfolgreich abgeschlossen", { durationMs: dt });
          } catch (err) {
            const dt = Math.round(performance.now() - t0);
            this.log.error("Demo-Command fehlgeschlagen", { durationMs: dt, err });
          }
        },
      });

      this.log.debug("Demo-Command registriert: salt-create-tile-0-0");
    } catch (err) {
      this.log.error("Fehler beim Registrieren von Demo-Commands", { err });
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
