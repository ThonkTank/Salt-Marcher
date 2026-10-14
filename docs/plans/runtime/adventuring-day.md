# Adventuring Day: Vorschau auf bestätigte Partyfakten

Ergänzt den [Party-/Scenevertrag](smr03-live-scene-contract.md#party--roster--und-adventuring-day-projektion).
Fachquellen sind `requirements-adventuring-day-dropdown.md` und
`requirements-adventuring-day-calculator.md` im gebundenen
[Quellenregister](../../scope-sources.json). Der Rechner gehört zur Party.

## Nutzerablauf und Vertrag

Der GM öffnet den Topbarrechner, verwendet die aktive Party oder bearbeitet eigene
Level-/Anzahlzeilen. Budget und XP→Tage zeigen Tagesbudget, Encounterthresholds,
Rastetappen und Levelprognose. Verbrauchs-XP und Verdienst-XP können getrennt
berechnet werden. Die Vorschau vergibt keine XP, bestätigt keine Rast und bewegt
keine Scenezeit. Änderungen bleiben bei `executeProgress`.

- Aktive Figuren umfassen alle Split Scenes, unabhängig vom Fokus. Der Reader
  verwendet nur ihre geprüften Profil-/Fortschrittsrecords; inaktive Figuren und
  Kampfmasken sind keine Rechnergrundlage. Beschädigte benötigte Records werden
  abgewiesen. Profil, XP und Raststand werden in einer SQLite-Transaktion gelesen.
- Fehlende XP bleiben unbekannt. Ein offener Raststand sperrt die Verbrauchsanzeige,
  aber kein aus bekannten Levels berechenbares Budget. Eigene Zeilen funktionieren
  auch bei unbekannten Party-Levels.
- Der gemeinsame Rechner verwendet feste Startlevelbudgets, zwei kurze Rasten
  und eine lange Rast pro Tag sowie `xpShare` für aufgerundete Verdienstverteilung.
  Aktive Figuren beginnen mit tatsächlichen XP, eigene Zeilen mit Levelminimum.
  Nach 30 vollständig dargestellten Tagen wird die Zeitleiste zusammengefasst;
  Gesamtzahlen bleiben vollständig.
- Rohwerte bleiben beim Bearbeiten erhalten. Leere Zahlenfelder sind ungültig;
  ausdrücklich eingegebene null XP sind gültig. Schließen erhält den Entwurf,
  Kampagnenreaktivierung verwirft ihn. Token und Antwortgeneration sperren ältere
  Antworten. Eine Vorschau ist keine Schreibgrundlage für einen späteren Award.

## Bestätigte XP-Abrechnung

`party-award` bucht Verdienst und Tagesbelastung atomar mit getrennten Empfängern:
Reservefiguren dürfen XP erhalten, Belastung nur aktive Figuren. Beide Pools
verwenden dieselbe aufgerundete Verteilung wie die Vorschau. Ein Receipt-Replay
wirkt nicht erneut; Scenezeit und Rasten werden damit nicht bestätigt.
`changeCharacterXp` verbindet Korrekturvorschau und Writer: Abzug endet am aktuellen
Levelfloor und reduziert lange/kurze Belastung sowie Rastbaseline bis mindestens
null. Addieren und Setzen erhalten diese Zähler; eine Korrektur ist keine Rast.

## Nachweise und nächste Arbeit

[Store-/Rechner-/DOM-Prüfungen](../../../tests/desktop-day-calculator.test.mjs)
prüfen aktive Datenquellen, unveränderte Datenbytes, Fresh, fehlende XP/Rasten,
Rundung, große Zeiträume, Split Scenes, Fokus-/Mitgliedschaftswechsel und verspätete
Antworten. [Zeilenprüfung](../../../tests/desktop-adventuring-day-dom.test.mjs)
prüft unfertige Rohwerte beim Hinzufügen und Entfernen.
[Abrechnungsprüfungen](../../../tests/desktop-party-xp.test.mjs) prüfen getrennte
Empfänger, Rundung, Rollback, Replay nach Fresh, Korrektur und Copy-Verweise;
[Antwortprüfungen](../../../tests/desktop-party-award-dom.test.mjs) erhalten neue
Eingaben nach Wiederöffnung oder Kampagnenreaktivierung. Das ersetzt keine native
Popover-, IPC-, Tastatur-, Last- oder Produktabnahme.

1. Rast-/Levelrechnung mit Fortschrittswriter und tatsächlichen Awards prüfen:
   vorgezogene kurze Rast, Level-up/XP-Korrektur ohne Zählerrücksetzung,
   Überverbrauch, getrennte Verdienst-XP und ausgewählte zeitgebundene Rasten.
2. Nativ Öffnen/Schließen, Escape und Fokus zum Trigger, Tastatur, 200 % Zoom,
   viele Zeilen, lange Namen sowie Storage-/IPCfehler prüfen. Fehler benötigter
   aktiver Records müssen den betroffenen Owner auffindbar machen.
3. Große aktive Party und häufige Fortschrittsänderungen messen. Nur belegte
   Engstellen ändern; kein persistierter Rechnerzustand oder zweites XP-/Rastmodell.
