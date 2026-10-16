# Narrative Eingaben, bezahlte Quests und sichere Wiederaufnahme

## Reproduzierter Ausgangspunkt

Beim Pflichtsync kollidierten persistente narrative Eingaben und strengere Narrative-Backupprüfungen. Beide Wirkungen wurden erhalten. Die gezielte Integrationsprüfung zeigte zusätzlich sieben Lücken: fehlende Award-/Statusverknüpfung, fehlender begrenzter Awardindex, ungebundene/missgebildete Drafts, fremde Draftmitwirkende sowie nicht remappte Quest-/Rumorherkunft in kopierten XPereignissen. 16 gezielte Tests bestehen nach der Zusammenführung einschließlich Snapshotkopie und anschließender Löschung der Quelle.

Native Gegenprobe am Integrationsstand `011ab3f5`: Nera erhält einmal 101 XP für „Karawane gerettet“. Nur in einer isolierten fiktiven Campaign wird bei geschlossener App der Statuslink zum vorhandenen Award entfernt, mit gültiger Checksumme. Das GMfenster zeigt die bereits bezahlte Quest anschließend wieder als abschließbar ([Ausgangsdaten](2026-10-13-narrative-before.json)). Der Award und die XP werden nicht gelöscht; die Probe vergibt nichts erneut.

Nach der Speicherprüfung wird der beschädigte Zusammenhang abgewiesen. Beim Wechsel von der gültigen Quest „Leuchtturm“ zur betroffenen Karawane bleibt aber das vorherige Formular mit 77 XP und Abschlussbutton sichtbar; der Bereich bleibt dauerhaft `aria-busy=true` ([Zwischenbefund](2026-10-13-narrative-guard-only.json)). Die alten Aktionen können den fremden Auftrag nicht wirksam schreiben, sind aber irreführend.

## Änderung und Vergleich

Beim Laden anderer narrative Angaben werden alte Werte, Bedienelemente und Callbackbindungen sofort entfernt. Ein Ladehinweis ersetzt sie. Bei Fehlern erscheint im Bereich eine zugängliche Meldung; der Busyzustand endet. Unprüfbare Daten werden weder als unbezahlt dargestellt noch automatisch normalisiert. Andere Questnotizen bleiben benutzbar.

Die Speicherintegration erhält unvollständige Stringeingaben, prüft aber Identität, Struktur, Eigentümer und Backupclosure. Bereits bestätigte Awards benötigen eine eindeutige Statuszuordnung. Quest-/Rumorherkunft in kopierten XPereignissen wird auf die Kopie remappt; unveränderliche Herkunft anderer Recordarten bleibt geschützt. Archivfehler benennen jetzt das betroffene Manifest ausdrücklich.

[Foundry dokumentiert Journal-Autosave und Markdownseiten](https://foundryvtt.com/article/journal/#the-page-editor). Das ist eine relevante Erwartung an unverlorene Autorenarbeit, kein hier bedienter Foundry-Rewardworkflow und kein Geschwindigkeitsnachweis. Eine einfache [Markdownnotiz](2026-10-13-narrative-paper.md) erhält unfertige Werte wie `101-`, `1,5` und `offen` direkt und kann eine bestätigte Zahlung ausdrücklich markieren. Sie wurde geschrieben und bytegleich wieder gelesen. Menschlicher Editor-/Papierzeitvergleich und genereller Produktvorsprung bleiben offen.

## Verifizierter Stand

97 betroffene Store-/DOM-/Transfer-/Narrativetests und Desktop-Typecheck bestanden. Drei neue DOMtests prüfen fehlgeschlagenes Laden nach einem gültigen Formular, Wechsel während einer offenen Antwort und eine verspätete alte Fehlerantwort. Build bestanden.

Die finale native Probe zeigt beim Fehler genau eine Meldung, keinen alten XPwert, keinen Abschlussbutton und `aria-busy=false` ([Daten](2026-10-13-narrative-after.json), [Bild](2026-10-13-narrative-after.png)). Im gültigen Leuchtturm bleiben `101-`, `1,5` und `offen` beim A→B→A-Wechsel und nach echtem Close/Neustart unverändert. Ein frischer Core bestätigt genau einen Award, genau 101 bereits gebuchte XP und unveränderte ursprüngliche GM-/Vorleseprosa. Die unfertigen Eingaben erzeugen keine Buchung.

Alle schweren Jobs liefen über `codex-dungeon-job qa`; ein Testworker, eigener Nativebaum im QAservice, kein Swap. Beide finalen Appstarts und beide Closewege endeten normal mit Exit 0, ohne Pageerrors. Nativer Peak 476,8 MiB; eigene Prozesse beendet. Der DBusproxy begrenzt ausschließlich den eigenen Testprozess und verhindert Chromiums Scopewechsel. Fremde Prozesse und Nutzerdaten bleiben unangetastet.

```sh
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/build-desktop.mjs
/home/aaron/.local/bin/codex-dungeon-job qa -- npm run test:desktop-narrative
/home/aaron/.local/bin/codex-dungeon-job qa -- node tools/test-desktop-narrative-recovery.mjs
```

Linux mit `xdg-dbus-proxy`. Kontrollierte Fehler, isolierte Campaigns und einzelne Transfer-/Löschfälle ersetzen keine vollständige Recovery-, Plattform- oder Gesamtproduktabnahme. Der beschädigte Statuslink wird ausdrücklich nicht automatisch repariert.
