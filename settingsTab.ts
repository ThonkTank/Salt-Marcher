/*
 * Salt Marcher – Settings Tab (integriert)
 * - Logger-Controls (Global-Level, Console/Notice, RingBuffer, MaxContextChars)
 * - Per-Namespace-Overrides (falls bekannt)
 * - Pfad-Settings (Hex/Locations/NPC/Factions/Sessions)
 * - Default-Region
 * - Ausführliche Debug-Logs in jedem onChange()
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type SaltMarcherPlugin from "./main";
import type { LogLevel } from "./logger";
import {
  createLogger,
  getKnownNamespaces,
  getLoggerConfig,
  setLoggerConfig,
} from "./logger";

export class SaltSettingsTab extends PluginSettingTab {
  plugin: SaltMarcherPlugin;
  private log = createLogger("UI/SettingsTab");

  constructor(app: App, plugin: SaltMarcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Salt Marcher – Einstellungen" });

    /* ───────────────────────── Logger: Global Level ───────────────────────── */
    containerEl.createEl("h3", { text: "Logging" });

    new Setting(containerEl)
      .setName("Log-Level (global)")
      .setDesc(
        "Mindeststufe für Logs. Per-Namespace-Overrides können einzelne Logger schärfer/weicher stellen."
      )
      .addDropdown((dd) => {
        (["error", "warn", "info", "debug", "trace"] as LogLevel[]).forEach(
          (lvl) => dd.addOption(lvl, lvl.toUpperCase())
        );
        dd.setValue(this.plugin.settings.logGlobalLevel);
        dd.onChange(async (value: LogLevel) => {
          try {
            this.log.debug("UI: logGlobalLevel changed", { value });
            this.plugin.settings.logGlobalLevel = value;
            await this.plugin.saveSettings();
            setLoggerConfig({ globalLevel: value });
          } catch (err) {
            this.log.error("Fehler beim Setzen von logGlobalLevel", { err, value });
          }
        });
      });

    
    /* ───────────────────────── Reise (P0) ───────────────────────── */
    containerEl.createEl("h3", { text: "Reise (P0)" });

new Setting(containerEl)
  .setName("Hex-Breite (Meilen)")
  .setDesc("Distanz pro benachbartem Hex-Schritt.")
  .addText((t) =>
    t.setValue(String(this.plugin.settings.travelHexWidthMiles))
      .onChange(async (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          this.plugin.settings.travelHexWidthMiles = n;
          await this.plugin.saveSettings();
        }
      })
  );

new Setting(containerEl)
  .setName("Basisgeschwindigkeit (mph)")
  .setDesc("Grundtempo zu Fuß, ohne Modifikatoren.")
  .addText((t) =>
    t.setValue(String(this.plugin.settings.travelBaseSpeedMph))
      .onChange(async (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          this.plugin.settings.travelBaseSpeedMph = n;
          await this.plugin.saveSettings();
        }
      })
  );

new Setting(containerEl)
  .setName("Straßen-Multiplikator")
  .setDesc("Wird verwendet, wenn onRoad=true (z. B. 0.7).")
  .addText((t) =>
    t.setValue(String(this.plugin.settings.travelRoadMod))
      .onChange(async (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          this.plugin.settings.travelRoadMod = n;
          await this.plugin.saveSettings();
        }
      })
  );

new Setting(containerEl)
  .setName("Flussquerung (Minuten)")
  .setDesc("Fixe Zusatzminuten für Segmente mit Flussquerung.")
  .addText((t) =>
    t.setValue(String(this.plugin.settings.travelRiverCrossingMin))
      .onChange(async (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) {
          this.plugin.settings.travelRiverCrossingMin = n;
          await this.plugin.saveSettings();
        }
      })
  );


    /* ───────────────────────── Logger: Sinks ───────────────────────── */
    new Setting(containerEl)
      .setName("Console-Ausgabe aktivieren")
      .setDesc("Logs in der DevTools-Konsole anzeigen.")
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.logEnableConsole);
        tg.onChange(async (v) => {
          try {
            this.log.debug("UI: logEnableConsole changed", { v });
            this.plugin.settings.logEnableConsole = v;
            await this.plugin.saveSettings();
            setLoggerConfig({ enableConsole: v });
          } catch (err) {
            this.log.error("Fehler beim Setzen von logEnableConsole", { err, v });
          }
        });
      });

    new Setting(containerEl)
      .setName("Notice bei WARN/ERROR")
      .setDesc("Zeige kurze Popups (Notices) bei wichtigen Problemen.")
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.logEnableNotice);
        tg.onChange(async (v) => {
          try {
            this.log.debug("UI: logEnableNotice changed", { v });
            this.plugin.settings.logEnableNotice = v;
            await this.plugin.saveSettings();
            setLoggerConfig({ enableNotice: v });
          } catch (err) {
            this.log.error("Fehler beim Setzen von logEnableNotice", { err, v });
          }
        });
      });

    /* ───────────────────────── Logger: Buffer/Truncate ───────────────────────── */
    new Setting(containerEl)
      .setName("Ring-Buffer Größe")
      .setDesc(
        "Wieviele Logeinträge intern gepuffert werden (z. B. für Export/Support)."
      )
      .addText((tb) => {
        tb.inputEl.type = "number";
        tb.setPlaceholder("500");
        tb.setValue(String(this.plugin.settings.logRingBufferSize ?? 500));
        tb.onChange(async (v) => {
          try {
            const num = Math.max(50, Math.min(50_000, Number(v) || 500));
            this.log.debug("UI: logRingBufferSize changed", { input: v, num });
            this.plugin.settings.logRingBufferSize = num;
            await this.plugin.saveSettings();
            setLoggerConfig({ ringBufferSize: num });
          } catch (err) {
            this.log.error("Fehler beim Setzen von ringBufferSize", { err, v });
          }
        });
      });

    new Setting(containerEl)
      .setName("Max. Kontext-Zeichen pro Entry")
      .setDesc(
        "Zur Sicherheit werden große Objekte/Strings im Log gekürzt. Dieser Wert begrenzt die Zeichenanzahl."
      )
      .addText((tb) => {
        tb.inputEl.type = "number";
        tb.setPlaceholder("10000");
        tb.setValue(String(this.plugin.settings.logMaxContextChars ?? 10_000));
        tb.onChange(async (v) => {
          try {
            const num = Math.max(500, Math.min(1_000_000, Number(v) || 10_000));
            this.log.debug("UI: logMaxContextChars changed", { input: v, num });
            this.plugin.settings.logMaxContextChars = num;
            await this.plugin.saveSettings();
            setLoggerConfig({ maxContextChars: num });
          } catch (err) {
            this.log.error("Fehler beim Setzen von maxContextChars", { err, v });
          }
        });
      });

    /* ───────────────────────── Logger: Per-Namespace Overrides ───────────────────────── */
    containerEl.createEl("h4", { text: "Per-Namespace-Overrides" });
    const nsDesc =
      "Optional: Setze für einzelne Logger ein eigenes Mindest-Level. 'inherit' = folgt globalem Level.";
    const nsBlock = containerEl.createDiv();
    nsBlock.createEl("p", { text: nsDesc });

    const currentCfg = getLoggerConfig();
    const knownNamespaces = getKnownNamespaces
      ? getKnownNamespaces()
      : Object.keys(this.plugin.settings.logPerNamespace || {}).sort();

    // Für jeden bekannten Namespace einen Eintrag zeigen
    knownNamespaces.forEach((ns) => {
      this.namespaceSetting(nsBlock, ns);
    });

    // Schneller Reset-Button für alle Overrides
    new Setting(containerEl)
      .setName("Per-Namespace-Overrides zurücksetzen")
      .setDesc("Entfernt alle individuellen Overrides und nutzt das globale Level.")
      .addButton((btn) => {
        btn.setButtonText("Alle zurücksetzen");
        btn.onClick(async () => {
          try {
            this.log.warn("UI: Reset all per-namespace overrides");
            this.plugin.settings.logPerNamespace = {};
            await this.plugin.saveSettings();
            setLoggerConfig({ perNamespace: {} });
            // UI neu zeichnen, damit Dropdowns wieder auf 'inherit' gehen
            this.display();
          } catch (err) {
            this.log.error("Fehler beim Reset der perNamespace-Overrides", { err });
          }
        });
      });

    // Kleines Diagnose-Panel
    new Setting(containerEl)
      .setName("Logger-Status anzeigen")
      .setDesc("Zeigt die aktuell aktive Logger-Konfiguration in der Konsole an.")
      .addButton((btn) => {
        btn.setButtonText("Dump to Console");
        btn.onClick(() => {
          const dump = getLoggerConfig();
          this.log.info("LoggerConfig dump", { dump });
          console.log("[SaltMarcher] LoggerConfig:", dump);
        });
      });

    /* ───────────────────────── Pfade & Vorlagen ───────────────────────── */
    containerEl.createEl("h3", { text: "Ordner & Vorlagen" });
    this.pathSetting(containerEl, "Hex-Ordner", "hexFolder");
    this.pathSetting(containerEl, "Locations-Ordner", "locationsFolder");
    this.pathSetting(containerEl, "NPC-Ordner", "npcFolder");
    this.pathSetting(containerEl, "Fraktionen-Ordner", "factionsFolder");
    this.pathSetting(containerEl, "Sessions-Ordner", "sessionsFolder");

    new Setting(containerEl)
      .setName("Default-Region")
      .setDesc("Wird genutzt, wenn keine Region angegeben ist.")
      .addText((tb) => {
        tb.setPlaceholder("Spitzberge");
        tb.setValue(this.plugin.settings.defaultRegion);
        tb.onChange(async (v) => {
          try {
            const cleaned = (v ?? "").trim() || "Spitzberge";
            this.log.debug("UI: defaultRegion changed", { input: v, cleaned });
            this.plugin.settings.defaultRegion = cleaned;
            await this.plugin.saveSettings();
          } catch (err) {
            this.log.error("Fehler beim Setzen von defaultRegion", { err, v });
          }
        });
      });
  }

  /* ───────────────────────── Helpers ───────────────────────── */

  /** Einfache Text-Input-Zeile für Ordnerpfade (mit defensivem Trimmen). */
  private pathSetting(
    containerEl: HTMLElement,
    label: string,
    key: keyof import("./settings").SaltSettings
  ) {
    new Setting(containerEl).setName(label).addText((tb) => {
      tb.setPlaceholder("Ordnername");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tb.setValue(String((this.plugin.settings as any)[key] ?? ""));
      tb.onChange(async (v) => {
        try {
          const cleaned = (v ?? "").toString().replace(/\\/g, "/").trim();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.plugin.settings as any)[key] = cleaned || (this.plugin.settings as any)[key];
          this.log.debug("UI: pathSetting changed", { key, input: v, cleaned });
          await this.plugin.saveSettings();
        } catch (err) {
          this.log.error("Fehler beim Setzen eines Pfad-Settings", { err, key, v });
        }
      });
    });
  }

  /** Dropdown-Zeile für einen Namespace-Override. */
  private namespaceSetting(containerEl: HTMLElement, namespace: string) {
    const current = this.plugin.settings.logPerNamespace?.[namespace];
    new Setting(containerEl)
      .setName(namespace)
      .setDesc("Override für diesen Logger.")
      .addDropdown((dd) => {
        // 'inherit' ist pseudo-Option (kein echtes LogLevel), um Override zu löschen
        const levels: Array<LogLevel | "inherit"> = [
          "inherit",
          "error",
          "warn",
          "info",
          "debug",
          "trace",
        ];
        levels.forEach((lvl) =>
          dd.addOption(lvl, lvl === "inherit" ? "(inherit)" : lvl.toUpperCase())
        );

        dd.setValue((current ?? "inherit") as string);

        dd.onChange(async (val: LogLevel | "inherit") => {
          try {
            this.log.debug("UI: perNamespace changed", { namespace, val });
            const updated = { ...(this.plugin.settings.logPerNamespace || {}) };
            if (val === "inherit") {
              delete updated[namespace];
            } else {
              updated[namespace] = val;
            }
            this.plugin.settings.logPerNamespace = updated;
            await this.plugin.saveSettings();
            setLoggerConfig({ perNamespace: updated });
          } catch (err) {
            this.log.error("Fehler beim Update von perNamespace", {
              err,
              namespace,
              val,
            });
          }
        });
      });
  }
}

