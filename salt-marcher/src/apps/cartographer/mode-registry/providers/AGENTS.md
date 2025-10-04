# Ziele
- Liefert die konkreten Provider-Fabriken für Travel-, Editor- und Inspector-Modus.
- Dokumentiert, welche Metadaten (`capabilities`, `order`, `keywords`) die Registry benötigt, um Modi zu sortieren und aufzubauen.
- Schafft Transparenz über Abhängigkeiten der Provider und über mögliche Inkonsistenzen zwischen Metadaten und den tatsächlichen Modi.

# Aktueller Stand
## Strukturüberblick
- `travel-guide.ts`, `editor.ts` und `inspector.ts` exportieren je eine `create…ModeProvider()`-Fabrik.
- Jede Fabrik ruft `defineCartographerModeProvider()` aus `../registry`, ergänzt Metadaten und liefert eine `load()`-Funktion, die den zugehörigen Modus per dynamischem Import nachlädt.
- Die Metadaten geben `capabilities` (Hex-Interaktion, Persistenzform, Sidebar-Nutzung), `order`, `keywords` und eine Quelle für Telemetrie-/Logmeldungen an.

## Integrationen & Abhängigkeiten
- `index.ts` im selben Verzeichnis bindet diese Provider ein, registriert sie über die Registry und kümmert sich um Lazy-Loading.
- Tests unter `tests/cartographer/mode-registry.test.ts` nutzen `defineCartographerModeProvider()`-Stubs, um Registry-Ereignisse, Sortierung und Lazy-Loading zu prüfen.
- Die reale Modus-Implementierung findet in `../modes/*.ts` statt. Änderungen an den Modulen erfordern angepasste Metadaten (z.B. `capabilities`, `summary`).

## Beobachtungen & Risiken
- Alle Provider führen nahezu identische Metadatenblöcke – Anpassungen (Version, Keywords, Reihenfolge) müssen daher dreifach erfolgen und laufen Gefahr, auseinanderzudriften.
- `metadata.source` verweist weiterhin auf die alte `core/cartographer/*`-Struktur; Fehlerlogs verlinken dadurch auf nicht mehr existente Module.
- Der Inspector-Modus schreibt Dateien über `saveTile()`, deklariert aber `persistence: "read-only"`. Die Registry erwartet bei nicht-read-only Modi eine `onSave()`-Implementierung, wodurch aktuell kein passender Persistenzwert existiert und die Metadaten ein falsches Verhalten signalisieren.
- Keine automatisierte Prüfung stellt sicher, dass die deklarierten `capabilities` mit den tatsächlich exportierten Methoden (`onHexClick`, `onSave`) übereinstimmen.

# ToDo
- [P2.47] Provider-Metadaten zentralisieren (z.B. über ein gemeinsames Manifest), `metadata.source` auf die aktuellen Module (`apps/cartographer/modes/*`) aktualisieren und die `version` aus `package.json` ableiten, damit Fehlerlogs und Telemetrie konsistent bleiben.
- [P2.48] Persistenz-Capabilities der Registry um eine Variante für Auto-Saves erweitern, den Inspector-Provider darauf umstellen und Tests ergänzen, die `capabilities` gegen die tatsächlichen Modusmethoden validieren.

# Standards
- Provider-Dateien beginnen mit einem Kurzsatz, der die externen Abhängigkeiten und den Moduszweck beschreibt.
- Metadaten spiegeln genau das Verhalten des Modus wider (Capabilities, Reihenfolge, Schlüsselwörter) und verweisen in `source` auf das tatsächliche Modul.
- `load()`-Funktionen liefern unveränderte Modusinstanzen; Fehler propagieren sie nach außen, damit die Registry Telemetrie-Events erzeugen kann.
