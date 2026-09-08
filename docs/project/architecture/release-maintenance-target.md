Der Zielzustand sollte **einen gemeinsamen Wartungsablauf, klar abgegrenzte Kompatibilitätszusagen und eine nachvollziehbare Release-Abnahme** haben. Die bestehenden Sicherheitsprüfungen bleiben erhalten; doppelte Implementierungen und unnötige vollständige Prüfläufe werden reduziert.

Der Umfang bleibt Linux x86_64, bewusste Updates und vorhandene Electron-Daten. Als erste öffentliche Electron-Version schlage ich **0.3.0** vor; der Tag ist derzeit frei.

**1. Ein Wartungsablauf für Local und Release**

Ein gemeinsamer Wartungskoordinator verantwortet Installation, Update, Profilübernahme und Wiederherstellung. Unterschiede zwischen Local und Release beschränken sich auf Installationspfade und Herkunft des geprüften AppImages.

| Verantwortlicher | Aufgabe |
|---|---|
| Gemeinsamer Koordinator | Transaktion, Zustandsübergänge, Journal und Recovery |
| Main beziehungsweise Wartungsmodus des AppImages | Netzwerk, Prozesse, Sperren und Programmaktivierung |
| Utility-Prozess | Sicherung, Migration und fachliche Datenprüfung |
| Bestehende Datenbankverantwortliche | SQL und einzelne Migrationen |
| Renderer | Entscheidungen des Nutzers und verständlicher Status |

Der Entwickler-Installer ruft diesen Ablauf auf. Seine eigenständige Datenaktivierung und Rücksetzungslogik entfällt nach erfolgreicher Umstellung.

Pro Installation gibt es **ein maßgebliches Wartungsjournal**, das vorherige und vorgesehene Programmversion, Datenverzeichnisse, Sicherung und Transaktionsstatus zusammenführt. Handoff-Belege dürfen weiterhin separat existieren, treffen aber keine Recovery-Entscheidungen.

Der Ablauf lautet:

1. Änderungen klären, neue Schreibbefehle sperren und laufende Befehle abschließen.
2. Datenverbindungen schließen; Profilsperre durchgehend halten.
3. Speicherbedarf prüfen und vollständige Sicherung validieren.
4. Arbeitskopie migrieren und fachlich prüfen.
5. Daten und Programm journalgestützt aktivieren.
6. Zielversion starten und prüfen.
7. Transaktion dauerhaft bestätigen, danach normale Nutzung freigeben.

Jeder kritische Dateisystemübergang erhält vorher einen dauerhaft geschriebenen Absichtseintrag. Recovery muss aus Journal **und tatsächlichem Dateizustand** eindeutig fortsetzen oder zurücksetzen können. Nach Bestätigung bleibt automatische Rücksetzung ausgeschlossen.

Eine Wiederherstellung verwendet die bereits installierte Programmversion; sie erzeugt keine unnötige weitere Kopie desselben AppImages.

**Abnahme:** Local und Release durchlaufen dieselben Zustandsübergänge und dieselben Fehlerfalltests. Alte Journale werden erkannt und abgearbeitet, bevor der neue Ablauf übernimmt.

**2. Ehrliche und durchsetzbare Profilkompatibilität**

Die Kompatibilitätsbeschreibung unterscheidet künftig zwei Fragen:

- Kann dieses Datenformat gelesen und migriert werden?
- Kann diese Quelle konsistent und exklusiv übernommen werden?

Alle künftig unterstützten Development-, Local- und Release-Laufzeiten verwenden dieselbe Sperrimplementierung am eindeutig bestimmten Profilort. Das Profil wird vor Sperrerwerb kanonisch aufgelöst; Pfad-Aliase dürfen keinen zweiten Zugang zur gleichen Quelle eröffnen.

Für ältere Anwendungen, die diese Sperre nicht beachten, gibt es keine zugesicherte direkte Übernahme eines möglicherweise aktiven Profilordners. Hier erfolgt der Import über einen **vollständigen, konsistent erzeugten und geprüften Backup-/Exportstand**. Welche älteren Versionen einen solchen Stand liefern können, wird ausdrücklich dokumentiert. Ein fehlender sicherer Übernahmeweg führt zu einer verständlichen Ablehnung.

Ein einmaliger Prozesscheck oder das Vorhandensein einer `SingletonLock`-Datei zählt nicht als Exklusivitätsnachweis.

**Abnahme:** Parallelstart während der Übernahme wird getestet. Quelle und Einstellungen bleiben unverändert; aktive, inaktive und gelöschte, wiederherstellbare Kampagnen sowie eigene Dateien werden verglichen.

**3. Ein vollständiger Speichern-/Verwerfen-Ablauf**

Die bisherige globale Sammlung schmutziger Editor-IDs wird durch eine kleine gemeinsame Schnittstelle für offene Änderungen ersetzt. Jeder beteiligte Editor stellt bereit:

- verständlichen Namen,
- aktuellen Änderungsstatus,
- seine vorhandene Speicherfunktion,
- seine vorhandene Verwerffunktion.

Die Fachlogik bleibt im Editor. Der Wartungsdialog zeigt die betroffenen Bereiche und bietet **Speichern und fortfahren**, **Verwerfen und fortfahren** sowie **Abbrechen**.

Ein Speicherfehler verhindert den Wartungsstart und bleibt am betroffenen Bereich verständlich sichtbar. Bereits erfolgreich gespeicherte Änderungen werden dabei nicht zurückgenommen. Während der Klärung können keine neuen Änderungen unbemerkt hinzukommen.

**Abnahme:** Mehrere gleichzeitig offene Editoren, fehlgeschlagenes Speichern, Abbrechen und Verwerfen werden über die Oberfläche geprüft. Der Nutzer muss nicht zwischen einem Wartungsdialog und mehreren Editoren hin- und hersuchen.

**4. Tests nach nachgewiesenem Risiko ordnen**

Die Abnahme trennt künftig ausdrücklich:

| Nachweis | Was er belegt |
|---|---|
| Migrationstests | Tatsächliche Schemaübergänge und erhaltene fachliche Daten |
| Transaktionstests | Verhalten bei Fehlern und Unterbrechungen |
| AppImage-Tests | Transport, Zielruntime, Installation und Neustart |
| UI-Tests | Tatsächliche Nutzerentscheidungen und Bedienabläufe |
| Livetest | Nutzbarkeit mit repräsentativen vorhandenen Kampagnendaten |

Die bestehende `0.1.99 → 0.2.0`-Prüfung bleibt ein Transportnachweis. Sie wird nicht als Nachweis historischer Migration bezeichnet.

Hinzu kommen echte unterschiedlich gebaute Teststände mit unterschiedlichen Schema-Versionen. Sie prüfen:

- Update ohne Schemaänderung,
- einen tatsächlichen Schemawechsel,
- Überspringen mindestens eines Zwischenstands,
- Fehler innerhalb einer Migration,
- Unterbrechungen an allen Aktivierungs- und Recovery-Grenzen,
- WAL-Daten, Platzmangel, Zugriffsfehler und parallelen Start,
- fehlende Migrationen und neuere Datenformate,
- Wiederherstellung mit vorgeschalteter Sicherung und späteren Änderungen.

Die Datenfixtures enthalten überprüfbare Einstellungen, eigene Inhalte, Kampagnenzustände und fortsetzbaren Spielstand. Ein bloß erfolgreicher Datenbankstart genügt nicht.

Leere Erstinstallation, bestehendes Profil und beschädigtes Profil sind eigene Abnahmefälle. So wird die gerade korrigierte Erstinstallationsannahme dauerhaft sichtbar.

**5. Schnellere Rückmeldung bei unverändert belastbarer Freigabe**

Vor einem Push laufen zunächst Formatierung, betroffene Lint-/Typprüfungen und gezielte Tests. Vor einem teuren Abnahmelauf werden außerdem Authentifizierung, Werkzeugversionen, Bildschirmumgebung, Speicherplatz und Versionsverfügbarkeit geprüft.

Laufende Prüfungen erhalten einen unveränderlichen Checkout. Änderungen am Arbeitsbaum dürfen ihre Aussage nicht nachträglich verwischen.

Für die CI gilt zunächst weiterhin die vorhandene verbindliche Prüfung. Eine gezieltere Auswahl wird separat eingeführt:

- vorhandene Fingerprints für App-, Test- und Auslieferungseingaben nutzen;
- jeder Prüfgruppe ihren konkreten Risikobereich zuordnen;
- unbekannte Zuordnungen lösen die vollständige Prüfung aus;
- eine zentrale Abschlussprüfung bewertet die erforderlichen Nachweise;
- jeder öffentliche Release durchläuft weiterhin die vollständige relevante Release-Abnahme.

Eine reine Verifier-Änderung benötigt damit eigene fachliche Tests und einen echten installierten Lauf, aber nicht automatisch sämtliche unveränderten UI-Szenarien. Diese Anpassung wird ausdrücklich in Workflowregeln und `AGENTS.md` verankert, statt bestehende Regeln informell zu umgehen.

**6. Release-Version, Nachweise und Dokumentation zusammenführen**

Vor jeder Release-Arbeit wird geprüft, ob Version und Tag frei sind. Die Sonderbehandlung einer fest codierten ersten Versionsnummer entfällt.

Ein ausdrücklicher Release-Abnahmeauftrag benennt Zielcommit, Zielversion und Vergleichsartefakte. Beim ersten Electron-Release sind das klar gekennzeichnete Testartefakte; danach kommen unveränderte veröffentlichte Electron-Artefakte hinzu. Releases ohne passendes Manifest werden nicht versehentlich als Baseline verwendet.

Der Veröffentlichungsablauf bleibt:

1. Kandidat und Handoff erfolgreich.
2. Derselbe Commit auf grünem `main`.
3. Release-AppImage einmal bauen und genau diese Datei qualifizieren.
4. Entwurf mit Manifest, Testergebnissen und Release Notes erstellen.
5. Livetest mit einer Kopie vorhandener Daten dokumentieren.
6. Veröffentlichung dieser unveränderten Bytes manuell freigeben.

Das GitHub-Environment einschließlich Freigaberegel wird tatsächlich eingerichtet und überprüft.

Für die Dokumentation bleiben drei klare Einstiege:

- **Datenvertrag:** unterstützte Formate, Quellen und Recovery-Garantien.
- **Betriebsanleitung:** Installation, Sicherungen und Wiederherstellung.
- **Release-Abnahme:** konkreter Commit, Artefakthash, bestandene und offene Nachweise.

Die Statusbegriffe werden verbindlich getrennt: **implementiert**, **automatisiert geprüft**, **lokal übergeben**, **live abgenommen**, **veröffentlicht**.

**Umsetzungsreihenfolge**

1. Versions- und Kompatibilitätsentscheidungen festhalten; vollständige Abnahmematrix erstellen.
2. Gemeinsamen Wartungskoordinator samt Übernahme vorhandener Journale einführen.
3. Profilsperren und sichere Übernahmewege vereinheitlichen.
4. Speichern-/Verwerfen-Ablauf integrieren.
5. Schemawechsel und Fehlerfälle mit echten AppImages qualifizieren.
6. CI-Auswahl und Dokumentation an die nachgewiesenen Verantwortlichkeiten anpassen.
7. Den ersten öffentlichen Electron-Release vollständig abnehmen.

**Fertig ist dieser Zielzustand erst, wenn ein öffentlich installierbares Artefakt den vollständigen Update-, Migrations- und Wiederherstellungsweg bestanden hat und seine Freigabe dokumentiert ist.** Ein erfolgreicher Local-Handoff allein erfüllt dieses Kriterium nicht.