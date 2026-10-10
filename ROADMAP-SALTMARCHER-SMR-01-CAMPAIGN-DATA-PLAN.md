# SMR-01 Campaign Identity and Data Lifecycle

Status: Entwurf; keine Implementierungsfreigabe.

## Scope

Der erste SMR-01-Lauf definiert nur die spätere Datenbesitz- und Acceptance-Grenze für Campaign-ID, Erstellen/Wechseln/Umbenennen, Trash/Restore/permanentes Löschen, Kopie, Import/Export, Autosave, Crash-Recovery und portable Daten. Er verlangt einen hostneutralen Lifecycle-Vertrag; keine UI, Datei-API oder gemeinsame Scene-/Zeit-/Atlas-API wird vorweggenommen.

## Hostneutraler Lifecycle-Vertrag

Jede kampagnenübergreifende Operation trägt eine stabile Operation-ID, die beteiligten Owner, erwartete Owner-Revisionen und ihren beabsichtigten Effekt. Der Vertrag führt genau die Stufen `Stage`, `Validate`, `Publish`, `Verify` und `Finalize`; jeder Owner publiziert ausschließlich seine eigene immutable Projektion oder sein eigenes Receipt. Ein unbekanntes Ergebnis wird über dieselbe Operation-ID idempotent abgefragt und je nach validiertem Receipt roll-forward oder rollback recovered. Kein Owner darf dazu fremde SQL-, Datei-, History- oder Runtime-Interna öffnen oder verändern.

Die Renderer-UI erhält nur validierte, enge Capability-Ports, immutable Projektionen und strukturierte Fehler; sie erhält keine Pfade, Handles oder Host-/Dateisystemrechte. Atlas und Dungeon nehmen ausschließlich über ihre jeweils ratifizierten, validierten Ports teil.

## Invarianten

- Jede Kampagne erhält eine stabile lokale Identität; Anzeigenamen sind nicht eindeutigkeitsstiftend.
- Mutationen sind atomar oder bleiben als klarer Recovery-Fall erhalten. Autosave bestätigt keinen unvollständigen Zustand.
- Trash ist wiederherstellbar; permanente Löschung benötigt eine explizite, nachvollziehbare Abschlussgrenze.
- Eine Kopie erhält neue Identitäten und vollständig unabhängige kampagneneigene Inhalte, Assets und Runtime-Zustände. Keine spätere Mutation darf in die Ausgangskampagne zurückwirken.
- Jeder Import erzeugt immer eine neue, unabhängige Kampagne und darf nie in eine vorhandene Kampagne mergen oder sie überschreiben. Er remappt jede Campaign-, Objekt- und Runtime-ID sowie jede interne Referenz vollständig auf die neue Identitätsmenge; Restore behält dagegen exakt die vorhandene Identität.
- Import/Export verwenden ein versioniertes, geschlossenes Manifest mit Prüfsummen für Campaign-Daten, Karten, Bilder, Audio, nötige wiederverwendbare Definitionen, Runtime, Recovery-Trash und retained unknown data. Es erlaubt eine quellrechnerunabhängige Wiederöffnung und behandelt jede Eingabe als untrusted: begrenzte Validierung, keine Ausführung, Netzauflösung, externen Pfade oder Traversal, keine unbeschränkte Dekompression, atomare Ablehnung und Cancellation sowie einen Cross-Platform-Roundtrip.
- Jedes Audio-Medium trägt eine stabile fachliche `AudioSourceId`, unveränderte Source-Metadaten und einen manifestgebundenen Bytebeleg. Beim Import bleiben diese fachlichen Angaben erhalten; erforderliches lokales ID-Remapping ist vollständig und atomar auf alle Cue-, Scene- und Runtime-Referenzen angewandt und als Rebind-Projektion sichtbar. Fehlende oder beschädigte Medien bleiben als identifizierte Referenz erhalten, liefern eine sichtbare Retry-/Rebind-Möglichkeit und werden nie still durch andere Medien ersetzt.
- Wiederverwendbare oder installationsweite Definitionen werden im Importpaket explizit als solche ausgewiesen. Identitäts- und Versionskonflikte zeigen vor jeder Mutation ihre Folgen; der GM verwirft eine Variante oder behält beide unter unabhängigen IDs. Die Entscheidung bleibt bis zur atomaren Veröffentlichung gestaged. Bis zur gemeinsamen Vertragsratifikation bleibt jeder nicht entschiedene Konflikt fail-closed; SMR-01 entscheidet weder still über Teilen noch über Duplizieren.
- Recovery erhält die aktive Kampagnenidentität sowie alle dauerhaft darstellbaren Zustände für fokussierte Running Scene, Encounter und Travel. Der Host folgt dabei der bestehenden expliziten Campaign-Continue-Grenze: kein verdecktes automatisches Session-Resume, aber eine sichere, vollständige Wiederaufnahme nach ausdrücklicher GM-Aktion.
- Beschädigung wird mindestens pro unabhängig adressierbarem kampagneneigenem Record, Asset, wiederverwendbarer Definition oder Runtime-Kontext erkannt, isoliert und offengelegt. Unbetroffene Kampagnendaten bleiben verwendbar; Originalbytes bleiben bis zu expliziter Recovery/Löschung erhalten. Vollständiger Export und offengelegter Salvage-Export sind getrennte Ergebnisse; nur Letzterer nennt jede Auslassung.
- Permanentes Löschen entfernt nach bestätigtem Abschluss Live-, Trash-, Staging-, Temp- und app-managed Recovery-Payloads der Kampagne. Frühere, vom GM selbst exportierte Pakete sind externe Kopien und nicht widerrufbar.
- Bestehende Dungeon-/Atlasdateien erhalten ihren Formatbesitz; SMR-01 besitzt keinen stillen Formatwechsel.

## Gemeinsame offene Verträge

Campaign-ID↔LiveScene-ID, Campaign-History, Scene-Zeit, Running-Scene-/Encounter-/Travel-Recovery, Atlas-/Dungeon-Mehrdatei-Commit, Revisiontoken, beteiligte Lifecycle-Owner und Recovery über mehrere Besitzer werden mit den betroffenen Peers ratifiziert. Die Teilungs- und Konfliktregeln installationsweiter Definitionen, Manifest-Format, Host-Port-Verträge, stabile Audio-Source-IDs/Rebind und Delete-Retention werden ebenfalls gemeinsam ratifiziert. Bis dahin konsumiert SMR-01 nur stabile IDs und immutable Projektionen.

## Acceptance-Reihenfolge

1. A/B/A: anlegen, wechseln, umbenennen und Neustart ohne Identitätsverwechslung.
2. Trash, Restore, Kopie und endgültiges Löschen mit jeweils nachweisbarer Besitzgrenze.
3. Kopie mit semantischem Vergleich: kampagneneigene Inhalte, Assets und Runtime sind vollständig unabhängig; Änderungen an einer Seite verändern die andere nie.
4. Autosave-Crash vor/während/nach jeder Lifecycle-Stufe und frische idempotente Recovery ohne stillen Datenverlust; unbekanntes Ergebnis führt ausschließlich zu validiertem Roll-forward oder Rollback. Aktive Campaign, fokussierte Running Scene sowie sicher persistierbare Encounter-/Travel-Zustände sind nach explizitem Continue wiederherstellbar.
5. Vollständiger Export/Import erzeugt ausschließlich eine neue Kampagne und beweist das vollständige ID-/Referenz-Remapping. Ein versioniertes, prüfsummengeschütztes Paket enthält alle geschlossenen Bestandteile einschließlich retained unknown data und öffnet plattformübergreifend auf einem unabhängigen Rechner wieder.
6. Untrusted-Paketmatrix: Traversal, externe Pfade, Netzreferenzen, Ausführung, ungültige Prüfsummen, unbeschränkte Dekompression und Cancellation werden vor atomarer Veröffentlichung abgewiesen; die UI sieht keine Pfade oder Handles.
7. Konflikte wiederverwendbarer Definitionen zeigen vor Mutation ihre Folgen; der GM verwirft eine Variante oder behält beide unter unabhängigen IDs. Beide Wege bleiben bis zum atomaren Publish recoverbar.
8. Audio-Roundtrip: Source-ID, Metadaten und manifestgebundene Bytes bleiben über Export, Import und Wiederöffnung erhalten. Ein erforderliches lokales Remapping rebindet jede Cue-, Scene- und Runtime-Referenz vollständig und sichtbar; fehlende oder beschädigte Medien zeigen Retry/Rebind statt eines stillen Ersatzes.
9. Ein gezielt beschädigter Einzelrecord, Asset, reusable definition oder Runtime-Kontext wird identifiziert und isoliert; übrige Kampagnendaten bleiben nutzbar. Vollständiger Export und offengelegter Salvage-Export sind getrennt, letzterer benennt jede Auslassung—einschließlich nicht wiederherstellbarer Audio-Medien.
10. Permanentes Löschen entfernt nach bestätigtem Lifecycle-Abschluss Live-, Trash-, Staging-, Temp- und app-managed Recovery-Payloads; frühere GM-Exporte bleiben ausdrücklich nicht widerrufbar.
11. Erst nach Owner-/Cloud-Ratifikation: Mehrdatei-Commit, History, Scene-/Zeitbeziehungen, Host-Ports, Audio-Rebind, Delete-Retention und gemeinsame Definitionsteilung.

## Gates

Ein unabhängiger Peer- und Architekturreview prüft Lifecycle-Stufen/Receipts, fremde Owner-Grenzen, vollständiges Remapping einschließlich Audio-Rebind, Manifest- und Paketattacken, Konfliktfolgen, Löschretention, Fehlerisolation und fehlende Renderer-Privilegien. Implementierung, Host- und Acceptance-Freigabe folgen erst nach ratifiziertem Vertragscommit.
