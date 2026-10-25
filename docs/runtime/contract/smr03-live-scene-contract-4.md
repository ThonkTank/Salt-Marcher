# Kernverträge und Umsetzung

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Kernverträge und Umsetzung

Das ungenutzte parallele Party-/Scene-Modell samt seinen Modelltests wurde
entfernt. Sein [letzter vollständiger Stand](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/tree/2deb18b3bfff5e66768299a5b2907a080b1144dc/src/features/live-session)
bleibt als historischer Beleg verfügbar. Der Produktanschluss und seine
Store-/UI-Verhaltenstests sind maßgeblich; eine zweite Implementation der alten
Class-, Envelope- oder Mehrbesitzerformen ist nicht erforderlich.

Der aktuelle Pfad führt über `LiveAction`/`LiveScene` in
[`live-contracts.ts`](../../../src/app/runtime/live-contracts.ts), `executeLive` und
`readLiveScene` in [`storage/live.ts`](../../../src/app/storage/live.ts) sowie
`captureVisitDetails` in [`storage/session.ts`](../../../src/app/storage/session.ts).
`apply-visit` prüft Plan-, Besuchs- und Zielscenebasis in derselben Transaktion,
speichert `scene_adoption` getrennt vom bearbeitbaren `live_scene` und schreibt
den tokenunabhängigen Commandfingerprint samt Receipt. `scene-content` ändert
Laufwerte ohne Herkunftslöschung. Der gelöschte `state.ts`-Codec ist kein aktueller
Speicherport. Die Szenarien in `desktop-session.test.mjs` und
`desktop-session-retention.test.mjs` prüfen tatsächliche Adoption, Rollback,
Wiederholung, Draftretention und unabhängige Kopie. Sie ersetzen keine native
Continue-/Split-/Zeit-/Masken- oder Erasureabnahme; diese Fachziele bleiben offen.

Die Fachorakel oben bleiben vollständig verbindlich. Readmodels sind
unveränderliche revisionierte Werte; Preparation aliasiert keine Runtime.
Rejoin schreibt ausdrücklich gewählte Zeit und Scenezuordnung atomar.

### Migration und Bestandsschutz

Code hat keinen Bestandsschutz. Migration erhält Originalinhalte/IDs/Links
und zeigt geprüften Importvergleich. Campaign ohne LiveSession bleibt gültig;
Initialize legt Primary/Clock/Focus ausdrücklich gemeinsam an. Copy remappt,
Restore erhält Identitäten; unknown/beschädigte Daten werden nicht still als
leerer Stand initialisiert. Kein Whole-Branch-Merge und keine allgemeine
Legacyarchitektur nur wegen historischer Existenz.

### Modell- und Realnachweis

Vergangene Testdateien und Receipts stehen unverändert in `acceptance.json`
und `116c16af48b6a073216685c8d8e2cc74fada82c3:docs/plans/runtime/smr03-live-scene-contract.md`.
Sie belegen ihren jeweiligen Kern-/Hostumfang. [P02/P03/P04/C01](../../project/verification/architecture-experiments.md)
prüfen den neuen gemeinsamen Anschluss; Modell-PASS ist kein Store-/OS-/
Runtime-/Player-PASS. Tatsächliche Tastatur/200 %, physischer Input und
independent review bleiben direkte Produktbelege.

### Szenenroster gemeinsam übernehmen und bewegen

Das kompakte Partyfenster zeigt bei einer laufenden Sitzung ausschließlich
die Figuren der fokussierten Szene und deren Rastmittelwert. Unter Aktionen
öffnet „Aktives Szenenroster bearbeiten“ eine Suchauswahl für aktuelle und
inaktive Figuren. Name, Spieler und Kennung bleiben sichtbar; Filterwechsel
erhalten die gesamte Auswahl. Die sichtbare Figurenkennung umfasst mindestens
acht Zeichen und wächst bei kollidierenden Präfixen bis zur Unterscheidbarkeit.
`partyIdentityPrefixes` wird von Roster- und Szenenzielprojektion gemeinsam
verwendet. Im Roster bestimmen alle zulässigen Figuren des aktuellen Snapshots
die Kürzung, bevor der Suchfilter angewendet wird: Suchen und Umordnen ändern
die sichtbare Identität nicht. Volle Command-IDs, Profile und gespeicherte Texte
bleiben erhalten. Ein DOM-Gegenfall mit gleichen Namen/Spielern und UUIDs,
die erst im letzten Zeichen abweichen, prüft Auswahl, Filter und Reihenfolge;
der bisherige Test mit unterschiedlichen kurzen IDs deckte diese Verwechslung
nicht ab. Suche, Anzahl und Übernahme bleiben auch bei
240×160px erreichbar, die Liste scrollt separat. Die Auswahl wird erst mit
„Übernehmen“ gemeinsam bestätigt. Andere Szenen werden über „Figuren gemeinsam
verschieben“ erreicht; der bestehende Move-Dialog erhält „Alle auswählen“ und
Ziele aus Ort und tatsächlichen Mitgliedern. Nur gleiche sichtbare Beschriftungen
erhalten eine kurze Kennung. `partySceneLabels` gruppiert dafür auch kanonisch
äquivalente Unicode-Schreibweisen, ohne die Originaltexte umzuschreiben. Bei
gleichen ersten acht IDzeichen wächst das Präfix bis zur eindeutigen
Unterscheidung in der Gruppe; Szenenreihenfolge und vollständige Ziel-IDs bleiben
unverändert. Historische Szenentitel werden nicht umbenannt. Namenlose
neue Szenen erben weiterhin Ort, Position und Uhr über den vorhandenen Command.
Ein Split wechselt den Fokus nur nach der bestehenden Lifecycle-Regel.

`scene-roster` bindet eine komplette Auswahl an Roster-, Fokus- und
Szenenmitgliedschaftsrevision. Alle ausgewählten IDs werden vor der ersten
Mutation auf Verfügbarkeit und Szenenzugehörigkeit geprüft. Hinzufügen und
Entfernen, Masken-/Chaseabgleich, Scene-Cleanup, Chronikeintrag und Receipt
liegen in derselben bestehenden SQLite-Transaktion. Ein Repeat erhält dasselbe
Receipt; ein Reconciliationfehler rollt auch Party- und Receiptänderungen zurück.
Dies ist eine gemeinsame Membershipänderung, keine Schleife separat bestätigter
Einzelbefehle. Keine neue Tabelle oder Schemaänderung.

Die Probe mit45 Figuren prüft gleiche Namen, Auswahl außerhalb des Filters und
Tastaturfokus. Storefälle prüfen Reopen, Replay, Fremdszenen, Stale-Basis und
atomaren Rollback im Maskenabgleich. Ein nativer Ablauf übernimmt die Auswahl,
teilt eine namenlose Szene ab, führt sie über das bestehende Ziel wieder
zusammen und liest den Zustand nach vollständigem Neustart. Eine weitere native
Probe erzeugt gültige UUIDs mit absichtlich gleichen ersten acht Zeichen und
drei gleich beschriftete Szenen. Die Auswahl über den eindeutigen Zieltext
schreibt genau einen bestehenden Movecommand an die passende vollständige ID;
andere Gruppe, Titel, Uhren, Profile, XP und Rast bleiben erhalten. Ein regulärer
Appneustart liest denselben Zielzustand. Das ist ein begrenzter Zielauswahlbeleg,
keine gesamte Partyabnahme und keine Datenmigration.

Offen bleiben Party-Undo/Redo einschließlich100-Schritt-History, vollständige
Fenstermigration und OS-/200%-Abnahme. Persönliche Loot-/Rosterübergaben sind
im folgenden Abschnitt angeschlossen.
Der strenge aktuelle Livereader akzeptiert weiterhin keine beschädigte aktive
Zuordnung ohne Szene; die historische „Ohne Szene“-Recovery benötigt einen
eigenen, ausdrücklich begrenzten Migrationsanschluss. Die Chronik dieses Commands
ist kein Ersatz für die noch fehlende kausale Party-Undo-History.


### Persönliche Beute direkt im Partyfenster

Die aktuelle [Partyfenster-Anforderung](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/9de85c1a/docs/party/requirements/requirements-party-window.md)
ersetzt ausdrücklich das historische Dropdown. Aufgeklappte Figurendetails
zeigen die ausgewählten Schnellwerte sowie „Beute und Verlauf“ und den Sprung
zum identitätsgebundenen Charakter-Roster. Die kompakte erste Zeile bleibt bei
Name, XP und Rast; eine zweite Schnellwertezeile entfällt.

Profilanlage und Profiländerung verwenden nach bestätigter Writer-Antwort
denselben identitätsgebundenen Roster-Sprung. Er öffnet das Roster, setzt den
vorhandenen Identitätsfilter. Die Suche erhält den Fokus erst nach Freigabe der
Controls und nur in derselben Kampagne und Partyfenster-Instanz. Die bestätigte Figur
bleibt dadurch auch nach Namensänderung, unter einem früheren Filter und jenseits
der ersten 40 Einträge erreichbar; gleichnamige Figuren bleiben getrennt.
Fehlgeschlagene oder veraltete Antworten behalten Formular und bisherigen Filter.
Es entsteht kein zweiter dauerhafter Auswahlzustand. Die native Quellbuild-Probe
`tools/test-desktop-character-profile.mjs` verbindet dies mit offenen Profilwerten,
XP-Setzen/-Addition/-Abzug, unveränderten Rastfakten und frischer Neuöffnung.

Die persönliche Beute ist innerhalb desselben Fensters durchsuchbar, nach
Erhalten/Verkauft/Weitergegeben filterbar und paginiert. Herkunft, unbekannte
Werte, gekaufte oder übernommene Einträge und der kumulative erhaltene Wert
bleiben unterscheidbar. Mengenberichtigungen verlangen eine ausdrücklich
eingetragene nichtnegative Gesamtmenge und einen Grund; verkaufte Einträge
behalten ihren tatsächlichen Gesamtpreis. Der vorhandene Progress-Writer
schreibt Revision, Receipt und nachvollziehbare Vorher-/Nachher-Historie.
Es gibt weder ein zweites Ledger noch einen neuen Speichertyp.

Die Party bindet Lesen und Schreiben an Kampagnentoken, Figuren-ID und
Fenstergeneration. Ein frischer Detailread prüft die gewählte Ledgerrevision,
ohne eine Auswahl im versteckten Live-Beuteregister vorauszusetzen. Abgelaufene
Antworten dürfen keine andere Figur oder geschlossenes Fenster überschreiben.
Bei unbestätigter Buchung bleiben Eingaben erhalten; „Buchungsstatus prüfen“
nutzt die vorhandene Receipt-Recovery direkt im Fenster. Es gibt keinen automatischen Neuversuch.

Gezielte Panel-, Party- und Ledger-Verhaltenstests prüfen Suche/Paging,
gleichnamige Figuren, Berichtigung, gespeicherte Verkaufspreise, stale Reads
und geschlossene Auswahl. Ein nativer Electron-Ablauf öffnet die Beute vom
Atlas, berichtigt7 auf3, liest den Verlauf, öffnet die zweite gleichnamige
Figur und prüft den gespeicherten Stand nach regulärem Neustart. Roster,
Szenenuhr, XP und Rast bleiben dabei unverändert; die Ansicht scrollt bei
240×160px ohne horizontales Überlaufen. Dies belegt diesen Anschluss, keine
vollständige OS-, 200%- oder kausale Party-Undo-Abnahme.
