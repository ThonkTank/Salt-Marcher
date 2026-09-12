# Salt Marcher unter Linux benutzen

Diese Anleitung beschreibt den Releasekanal für Linux x86_64. Der erste öffentliche
Release 0.3.0 ist noch nicht freigegeben; den Abnahmestand dokumentiert das
[Ausführungsprotokoll](../roadmap-execution.md).

## Installieren und Daten übernehmen

Öffne das freigegebene AppImage und wähle „Auf diesem Rechner installieren“.
Bestätige den Neustart. Die Installation erfolgt im eigenen Benutzerkonto ohne
Administratorrechte, Node, pnpm oder Git. Anschließend startest du Salt Marcher
über den angelegten Desktop-Eintrag.

Unter „Einstellungen“ kannst du ein vorhandenes Profil übernehmen. „Profilordner
übernehmen“ erwartet den Ordner `profile` einer unterstützten installierten App.
Beende die Quell-App vorher. Bei einer erkannten Local-Installation wird auch
„Profil von SaltMarcher Local übernehmen“ angeboten. Die App prüft Quelle und
Sperre, kopiert das vollständige Profil und lässt die Quelle unverändert.

Wird die direkte Quelle abgewiesen, wähle eine geprüfte Sicherung der
Quellinstallation. Ein beliebiger alter Datenbankordner oder ein Diagnoseexport
ist kein Ersatz für eine solche Sicherung. Die genauen Voraussetzungen stehen im
[Datenvertrag](../project/contract/persistence-lifecycle.md#source-compatibility-for-the-planned-public-baseline).
Mehrere Profile werden nicht zusammengeführt. Vor dem Ersetzen sichert die App
den aktuellen Stand. „Mit leerem Profil anfangen“ ist eine ausdrückliche
Alternative und sichert ebenfalls vorher das bisherige Profil.

## Updates bewusst installieren

Unter „Einstellungen“ zeigt „Updates“ die installierte und gegebenenfalls eine
verfügbare Version mit Änderungen. „Jetzt prüfen“ sucht nach einem Release.
Automatische Prüfungen erfolgen beim Start mit höchstens einer Prüfung pro Tag;
ohne Internet kannst du weiterarbeiten.

„Herunterladen“ lädt die neue Version. Erst „Installieren und neu starten“ beginnt
die Wartung. Bei offenen Änderungen entscheidest du zwischen „Speichern und
fortfahren“, „Verwerfen und fortfahren“ und „Abbrechen“. Ein Speicherfehler
verhindert die Installation; bereits erfolgreich gespeicherte Änderungen bleiben
erhalten. Behebe den angezeigten Fehler oder brich den Vorgang ab.

Vor der Aktivierung erstellt und prüft die App eine Sicherung. Migrationen laufen
auf einer Arbeitskopie. Ein fehlgeschlagener Download wird nicht aktiviert;
fehlender Platz oder inkompatible Daten führen zu einer Fehlermeldung mit nächster
Aktion. Beim Beenden wird kein Update automatisch installiert.

## Sicherungen und Wiederherstellung

In „Einstellungen → Sicherungen“ stehen Datum, Version, Größe, Prüfergebnis und
Umfang. „Vollständiges Profil“ enthält auch Profileinstellungen und eigene
Dateien. Eine „Ältere Kampagnendatensicherung“ enthält nur die damals gesicherten
Kampagnendaten; fehlende Profileinstellungen kann sie nicht wiederherstellen.

Wähle „Wiederherstellen“ bei einer geprüften Sicherung und bestätige den Vorgang.
Das ersetzt das gesamte Profil; es führt keine Änderungen zusammen. Auch bei
einer älteren Kampagnendatensicherung werden zusätzliche aktuelle Profildateien
nicht übernommen. Die App sichert zuvor das aktuelle vollständige Profil; darin
bleiben diese Dateien erhalten. So kannst du
später auch wieder zu diesem Stand zurückkehren. Alte Sicherungen werden auf einer
Arbeitskopie vorwärtsmigriert. Neuere inkompatible Sicherungen werden abgewiesen.
Sicherungen werden nicht automatisch gelöscht.

Wenn Kampagnendaten nicht starten, bietet die Wiederherstellungsansicht weiterhin
Zugriff auf die Sicherungen. Nach einem unterbrochenen Update starte die App über
den installierten Desktop-Eintrag: Der stabile Startpunkt bearbeitet das Journal.
Nach bereits freigegebener Nutzung setzt ein späterer Absturz deine Arbeit nicht
automatisch auf einen älteren Stand zurück.

Der Installationsort ist `${XDG_DATA_HOME:-~/.local/share}/salt-marcher`.
Programmversionen, Profil, Sicherungen und Wartungszustand gehören zusammen;
ersetze bei einem Fehler keine einzelnen Datenbanken von Hand. Nutze die
angezeigte Wiederherstellungsaktion. Development und Local bleiben getrennt.

Der Ablauf für Ersteller eines Releases steht in der
[Release-Betriebsanleitung](release-process.md).
