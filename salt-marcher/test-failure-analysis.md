# npm test – Fehleranalyse

_Statusaktualisierung:_ Alle beschriebenen Fehler wurden behoben. Die folgenden Abschnitte dokumentieren Ursache und gewählte Korrektur.

## Cartographer Mode Registry
- ✅ **loads registered providers lazily**: Tests ergänzen nun `onHexClick`, wenn `mapInteraction: "hex-click"` verlangt wird, damit die neue Validierung erfüllt ist.
- ✅ **rejects duplicate registrations**: Provider-Metadaten enthalten wieder vollständige `capabilities`, sodass die Dublettenprüfung erreicht wird.
- ✅ **validates capability contracts when loading modes**: Der Test erzwingt weiterhin die `manual-save`-Fehlerprüfung, ohne von `mapInteraction`-Validierungen blockiert zu werden.

## Cartographer Presenter
- ✅ **skips mode save handler when persistence capability is read-only**: Registry-Testhelfer spiegeln jetzt die Capability-Kapselung wider, wodurch der Presenter keinen Read-Only-Modus mehr speichert.
- ✅ **ignores hex click when capability disables map interaction**: Die angepassten Fixtures entfernen Hex-Klick-Handler, sobald die Capability dies verbietet.

## Regions Store Watcher
- ✅ **alle drei Tests**: Die Tests ersetzen direkte Zuweisungen durch einen Spy auf `Obsidian.normalizePath`, womit der Read-Only-Getter respektiert wird.

## UI Language Policy
- ✅ **contains no German characters in monitored UI sources**: Die Dateisuche prüft vorhandene Dateien und ignoriert entfernte Ziele wie `UiOverview.txt`.
