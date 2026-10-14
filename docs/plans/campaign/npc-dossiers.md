# NPC-Dossier, Gespräch und bestehende Fachbesitzer

Stand: 15.10.2026. Ergänzt Kampagnenwissen, Party-/Livebetrieb,
Encounter und [Actor Autonomy](../runtime/actor-autonomy.md). Die fachlichen
Owner bleiben Weltprofil, LiveScene, Combat und Autonomie; das Dossier liest
und vermittelt zwischen ihnen. SRC-F02 verlangt kampagneneigene NPCs und
unabhängige Kopien bei gleichen möglichen Namen; narrative Aufzeichnungen
bleiben manuell aufgelöste GM-Inhalte. Eine Headerergänzung ist keine automatische
Quest- oder Ereignisauflösung.

## Aktueller Vertrag

`storage/npc-cast.ts` liest Ortsliste und Dossier über die Transaktionen von
`CampaignStore.npcCast/npcDossier`. Der Rückgabestand verbindet Worldnotiz,
NPC-Record, Fraktionshaltung, Actor/HP, Ort, Beziehungen, Gruppen, Autonomie und
bestätigte Logs. Die Ergebnisgrenzen von Beziehungen/Logs begrenzen die Anzeige;
sie sind kein Lastbeleg für den Such-/Relationsscan. Der Ortsfilter verwendet
derzeit die Scene-Ortsbindung, bei fehlendem Ort unverortete NPCs. Das belegt
keine Hex-/Dungeonsichtlinie, Wahrnehmung oder Anwesenheit am selben Kartenpunkt;
diese Übergänge zum Spatial-/Player-/Autonomieowner bleiben separat offen.

`NpcCastBinder` bindet Öffnen, Listen-/Detailantworten und Schaltflächen an den
ursprünglichen Dialog, Campaigntoken, Scene und Gruppenort. Eine frühere Auswahl
oder entfernte Schaltfläche darf keine spätere Figur verwenden. Vor einer
Fachaktion wird die angezeigte NPC-Basis nochmals geprüft: Notiz-/Record-/Actor-/
Positionsrevision sowie abgeleitete Haltung und Rolle. Das Lesen einer neueren
Fassung ist keine Zustimmung zu deren Übernahme. Bei geändertem Stand bleibt
das Dossier offen und verlangt Aktualisieren und erneute Auswahl der Aktion.
Ein Gespräch bindet außerdem angezeigte Gruppenzeit, Datum und Titel. Der
Vorlesetext behält die gezeigten Autorenbytes einschließlich CRLF.

Die Übergabe trägt eine Gültigkeitsprüfung durch weitere Workspace-/Editor-
Flusches. `openNpcProfile` prüft sie auch nach Profil-/Draftlesen, bevor ein
Gesprächsheader ergänzt wird. `addLiveNpc/addWorldNpc` prüfen sie nach Runtime-/
NPC-Lesen und vor Dispatch; Combat prüft sie nochmals nach seiner Rohsicherung.
Ein bereits gesendeter Command bleibt eine eigene fachliche Tatsache. Das
Anlegen einer neuen Maske und Hinzufügen des NPC sind weiterhin zwei Commands:
wird die Übergabe danach ungültig, darf der bestätigte erste Schritt nicht
stillschweigend rückgängig gemacht oder erneut gesendet werden.

`NpcDraft.fields.contact` hält Gespräch/Beobachtung als Rohtext getrennt von der
bestätigten Geschichte. Der bestehende Draftwriter sichert unvollständige
Eingaben; erst ausdrückliches „NPC übernehmen“ hängt den Text an die Geschichte
und konsumiert genau den passenden CAS-Entwurf. Altentwürfe ohne dieses optionale
Feld bleiben lesbar; fehlender Text wird nicht als historische Tatsache ergänzt.
Alte Dialogantworten melden oder entsperren keine neue Übergabe.

## Nächste Lieferung und Abnahme

- Unbekannte Ausgänge beim Übernehmen eines NPC-Profils mit der ursprünglichen Command-ID, unverändertem
  Payload und CAS-Entwurf über Reopen/Fresh prüfen. Ein verschwundener Draft ist
  kein alleiniger Erfolgsbeleg; erneuter Gesprächsanhang darf nicht duplizieren.
- Gespräch als freien Autorenrohtext von strukturierten späteren Zeit-/Quest-
  Folgen unterscheiden. Eine spätere strukturierte Gesprächschronik braucht
  Scene-/NPC-Identität, Kalender-/Clockbasis und Migration; bestehende Prosa wird
  dadurch nicht umgeschrieben oder als automatisch verifizierter Fakt behandelt.
- Beziehungen/Fraktion/Papierkorb, NPC-Defeat/Reaktivierung, Maskeneintritt und
  Autonomie-Catch-up gemeinsam prüfen. Bestätigte NPC-Identität und HP bleiben
  gemeinsame Fakten; freigegebene Autonomie wird vom Dossier nicht aktiviert.
- Nativ: NPC am Gruppenort wählen → Gespräch beginnen → während Flush/Fachwechsel
  Gruppe, Ort oder Figur wechseln → keine fremde Eingabe/alte Statusmeldung;
  aktuellen Gesprächsrohtext → Neustart → explizit übernehmen → genau einmalige
  Geschichte. Vorlesen, Tastatur/200 %, abgelegte Schaltflächen, beschädigte
  Einzelquellen und verzögerte Antworten gehören in denselben Ablauf.

Lokale Kontexttests sowie echter NPC-Renderer/SQLitewriter prüfen diese engeren
Übergänge und Entwurfsbytes. Frischer SQLite-Leser, Rendereraktivierung und
native Appwiederaufnahme sind getrennte Belege; vollständige Produktabnahme,
unbekannte Ausgänge beim Übernehmen eines Profils und native Erreichbarkeit bleiben offen.
