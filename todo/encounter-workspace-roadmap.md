# Encounter Workspace Roadmap

## Kontext
- Travel-Mode löst über `createPlayback.checkEncounter()` stündliche Encounter-Prüfungen aus und pausiert die Reise, sobald `onEncounter` feuert.【F:salt-marcher/src/apps/cartographer/travel/domain/playback.ts†L60-L166】
- Das Gateway `openEncounter` öffnet anschließend lediglich den registrierten Obsidian-View, ohne Metadaten aus dem Trigger zu übergeben.【F:salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts†L10-L43】
- `EncounterView` ist derzeit ein Placeholder und stellt keine Interaktionen, Datenquellen oder Brücke zurück zum Travel-Mode bereit.【F:salt-marcher/src/apps/encounter/view.ts†L1-L21】

## Betroffene Module
- `salt-marcher/src/apps/cartographer/travel/domain/playback.ts`
- `salt-marcher/src/apps/cartographer/modes/travel-guide.ts`
- `salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts`
- `salt-marcher/src/apps/encounter/view.ts`
- Eventuelle neue Shared-Stores unter `salt-marcher/src/core/` oder `salt-marcher/src/ui/`

## Zielbild
1. Travel-Mode liefert Encounter-Kontext (Region, Würfelergebnis, Zeitstempel, ggf. vorbereitete Encounter-Notiz) strukturiert an das Gateway.
2. Der Encounter-Workspace stellt Werkzeuge zum Auflösen des Encounter bereit (Initiative, Notiz-Linking, Log) und kann Ergebnisse wieder an Travel zurückmelden (z. B. "Encounter resolved").
3. Fehler beim Öffnen oder Ausführen werden sauber propagiert, damit Travel-Playback nicht hängen bleibt.

## Investigation & Implementierungsschritte
1. **Anforderungsaufnahme**
   - Stakeholder: Cartographer-Team, Encounter-Tooling, GM-UX.
   - Review bestehende Wiki-Guides (`wiki/Encounter.md`) und validiere Soll-Szenarien.
2. **Datenmodell entwerfen**
   - Definiere Encounter-DTO (Region-ID, Tile, Odds, Uhrzeit, Trigger-Quelle).
   - Kläre Persistenz: ephemerer Store vs. Vault-Datei.
3. **Gateway erweitern**
   - Ergänze `openEncounter(app, context)` und sichere Abwärtskompatibilität.
   - Stelle sicher, dass Preload weiterhin funktioniert (Dynamic import bundling prüfen).
4. **EncounterView aufbauen**
   - MVP: Anzeige der Metadaten, Link auf relevante Notizen, Buttons für "Start Initiative" / "Encounter erledigt".
   - Langfristig: Integration mit Library (Monster/Region-Tabellen) und Logging.
5. **Rückkanal Travel**
   - Definiere API, über die Encounter das Playback fortsetzen oder Token-Positionen anpassen.
   - Ergänze Tests für Pause/Resume-Fluss.
6. **Fehler- & UX-Handling**
   - Nutzerfreundliche Notices bei Importfehlern oder fehlender Konfiguration.
   - Telemetrie/Logging-Hooks für Encounter-Lifecycle evaluieren.

## Nächste Schritte (Priorität ↓)
1. **P0 – Discovery-Workshop** (Owner: Architektur)
   - Workshop mit Travel- und Encounter-Verantwortlichen ansetzen, um Kontextfelder und UI-Erwartungen zu fixieren.
   - Dokumentationsergebnis direkt im Encounter-Overview ergänzen.
2. **P1 – Datenfluss-Prototyp** (Owner: Encounter-Entwicklung)
   - Minimalen Context-DTO implementieren, Travel-Callback erweitern und Encounter-View die Daten rendern lassen.
   - Akzeptanzkriterium: Encounter-Trigger zeigt Region & Uhrzeit an und erlaubt "Encounter beendet" als Dummy-Aktion.
3. **P2 – UX/Tooling-Ausbau** (Owner: GM-UX)
   - Initiative-Tracker und Verlinkung auf Library-Daten konzipieren.
   - Ergebnisse als Folge-To-Dos splitten.

## Referenzen
- Detailanalyse im Dokument [Encounter Workspace – Gateway & Ist-Zustand](../salt-marcher/docs/encounter/overview.md).
