# Timelineersatz und unabhängige Kampagnenkopie

Stand: 15.10.2026. Der Fachumfang folgt [Spielabendplanung](manual-session-planner.md)
und [Campaign/Data](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md).
Die gepinnten Program Capabilities (Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L57–70 und L648–666)
verlangen unabhängige Campaigninhalte und fortbestehende historische Fakten.
Quellenbindung: [Quellenregister](../../scope-sources.json), SHA256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Iststand und korrigierter Fehler

`storage/plan-replacement.ts` ersetzt eine Timeline unter ihrer ursprünglichen
`replacementBasis` und gegebenenfalls der geprüften Vorlagenbasis. Neue Besuche
bekommen neue Identitäten; der Zielplan bleibt derselbe. Der Sessionwriter und
sein Planpublisher bilden eine gemeinsame Transaktion. Die Historie hält
`planId`, `sourcePlanId`, `previousVisitIds` und `visitIds` fest. Entfernte Besuche
sind historische Identitäten und müssen nicht wieder als aktuelle Besuche existieren.

Beim Import remappte `storage/campaign-data.ts` bisher die Planreferenzen, aber
nicht die beiden Besuchslisten. Dadurch verwiesen Fakten einer unabhängigen
Kopie weiter auf IDs der Quellkampagne, einschließlich bereits entfernter
Besuche. Beide Listen gehören jetzt zu den ausdrücklichen lokalen ID-Feldern
im gemeinsamen JSON-Walker. Seine erste Phase erfasst auch nur historisch
vorhandene IDs; die zweite benutzt dieselbe Zuordnung für alle Referenzen.
Titel, Notizen und eingefrorene Texte werden weiterhin exakt erhalten. Ein
Text, der zufällig eine frühere ID enthält, wird nicht durch Textersetzung geändert.
Quellpaket und archivierte Originalbytes bleiben unverändert; JSON-Checksummen
werden für die neue Kopie neu gebildet. Keine Formatmigration ist erforderlich.

## Lokaler Nachweis und Grenzen

`tests/desktop-plan-replacement-copy.test.mjs` führt den echten Sessionwriter,
Export, unabhängigen Import und Fresh aus, jeweils für Ersetzen aus einer
Vorlage und vollständiges Leeren. Es prüft historische und aktuelle
Besuchszuordnung, unveränderte Notiztexte/Paketbytes und Backupfähigkeit.
Dieser Nachweis qualifiziert die Referenzkorrektur.

`tests/desktop-plan-replacement-world.test.mjs` ergänzt vier lokale Storewege:
angenommene World-NPCs und unabhängige Entwurfskopie; bereits vergebene und
noch unvergebene Belohnungen; veraltete Vorlagenbasis und atomarer Rollback bei
Receiptfehler; platzierte, noch unvergebene Beute mit erhaltener Worldidentität.
Timelineleerung/Fresh/Backup erhalten die geprüften Worldgruppen, Treasures und
XP. Retry erzeugt keine weiteren NPCs, Treasures oder Gutschriften. Eine neue
noch unvergebene Belohnung bekommt eine eigene Reward-ID; ihre bereits
platzierte Beute bleibt derselbe Worldbestand. Die Vergabe in der Kopie setzt
nicht den Vergabestatus der Vorlage. Das sind unterschiedliche Sachverhalte,
keine Pflicht zur erneuten Anlage akzeptierter Worldinhalte.

Diese Prüfungen enthalten noch keine zuvor beschädigten NPC-HP, Beuteallokation
oder spätere Ledgerkorrektur, keine vollständige Kopie dieser kombinierten
Worldzustände und keine native Bedien-/Crash-/Undoabnahme.

## Chronikmoment und Übergabe als Besuch vorbereiten

Der Desktopanschluss `preparation.ts::prepareNextVisit` ergänzt einen konkreten
Plan um einen neuen Besuch. Chronikmoment und Spielabendübergabe liefern Titel,
Notizen und optional den Ort; eine Übergabe kann vor einem bestimmten bestehenden
Besuch eingefügt werden. Die Chronik bleibt ein historischer Fakt. Das Anlegen des
Besuchs übernimmt weder eine Running Scene noch beginnt es einen Spielabend.

Der übergebene Plan und die angegebene Einfügeposition müssen weiterhin
existieren. Ein fehlendes Ziel erzeugt eine sichtbare Meldung ohne Schreibcommand;
es wird kein anderer Plan gewählt und keine veraltete Position zum Anhängen
umgedeutet. Ein bereits angezeigter Zielplan wird bei neuer Revision erneut
geöffnet, statt den bisherigen Entwurf still auf die neue Basis zu setzen. Ohne
expliziten Plan gilt der beim Aufruf ausgewählte Plan; nur ohne vorhandenen
Zielplan legt der bestehende Anschluss einen neuen Spielabendplan an.

Workspaceidentität, Aktivierungszyklus, Auswahl und Eingabestand werden über die
asynchronen Grenzen geprüft. Neue Eingabe während des Zielreads verhindert die
Veröffentlichung. Eingabe während einer bereits gesendeten Speicherung bleibt im
ursprünglichen Editor erhalten: Der gemeinsame Writer verbindet sie mit dem
bestätigten Plan, und die Besuchsübergabe verwirft diesen Draft nicht mehr. Eine
Antwort aus einer früheren Aktivierung desselben Workspace steuert den neuen
Editor nicht um. Ein Fehler wird über den vorhandenen Vorbereitungsstatus und
Receiptweg behandelt; kein automatischer Neuversuch erzeugt einen zweiten Besuch.

Ein unklarer Besuchsauftrag an einen bereits vorhandenen, gerade nicht geöffneten
Plan wird zusätzlich unter genau diesem Plan als `PreparationDraft` gesichert.
Der sichtbare Editor wird nicht zum Ersatzowner. Originalcommand, Kommando-ID,
Plan-ID, Basisrevision und Prosa bleiben erhalten. Ein schon gesicherter späterer
Entwurf dieses Zieles hat Vorrang vor der älteren gesendeten Fassung. Eine weitere
Übergabe prüft den Zielentwurf vor Veröffentlichung und lässt einen offenen
Auftrag zuerst im Zielplan aufklären. Die zwei lokalen Fehlerfälle sind Ablehnung
vor Commit und verlorene Antwort nach Commit; eine neue Storeinstanz findet
jeweils denselben Auftrag und unterscheidet `not-applied` von `applied`, ohne ihn
automatisch erneut auszuführen. Das vorhandene Draftformat bleibt unverändert.

Der neue Übergabedialog lässt Zielplan, Titel, getrennten Vorlesetext und private
Notizen vor dem Speichern prüfen. Die ausdrückliche Auswahl eines neuen Plans
wird als solche an den Writer übergeben; ein leerer Selectwert darf nicht im
bisher ausgewählten Plan landen. Bestehende Workspace-/Resume-Bindungen gelten
auch während dieses Dialogs. Das Anlegen von Timeline und anschließenden
Mappenangaben sind derzeit zwei Storecommands und noch kein atomarer Gesamtweg.
Ein Fehler des zweiten Schritts ist kein Nachweis, dass der Besuch fehlt.

Die Übergabe erhält als Notiz eine erklärende Überschrift und danach den
vollständigen Originaltext, einschließlich CRLF und Randwhitespace. Die Ableitung
des kurzen Besuchstitels bleibt davon getrennt. Der Plantext wird nicht mehr
stillschweigend auf 10000 Zeichen gekürzt. Bestehende Pläne benötigen keine
Migration oder nachträgliche Textänderung.

`tests/desktop-visit-handoff.test.mjs` prüft den tatsächlichen Preparationcontroller
mit CampaignStore: fehlendes Ziel, veraltete Position/Revision, verzögerte Reads
und Bestätigungen, neue Eingabe, erneute Aktivierung und positiven Insert mit
unveränderten bestehenden Besuchen sowie neuem Storehandle. Die Textprobe bindet
die abgeleitete Übergabenotiz an ihre Originalbytes. Diese Belege ersetzen keinen
frischen nativen App-Prozess, keine Tastatur-/IME-Abnahme und keine vollständige
Recoveryqualifikation. Insbesondere Neuplananlage mit verlorenem Reply und
Übernahme aus langen nativen Textfeldern bleiben gezielte Folgeabnahmen.

## Offene Anlage- und Mappen-Recovery

1. `preparation-contracts.ts`, `preparation.ts`, `storage/store.ts`: Ein vollständig
   neuer Plan (`expectedRevision=null`) besitzt vor Commit noch keinen Draftowner.
   Die aktuelle Sicherung lehnt diesen Fall ausdrücklich ab und blockiert normales
   Verlassen bei ungeklärtem Auftrag. Crash-/Neustartsicherheit ist damit offen.
   Vor Veröffentlichung müssen Anlageabsicht, Originalcommand und vollständige
   Texte dauerhaft gesichert und beim Öffnen der Kampagne auffindbar sein. Eine
   Statusprüfung darf anhand des Originalreceipts bestätigen oder Nichtanwendung
   feststellen, aber nicht automatisch einen neuen Plan erzeugen. Abnahme:
   Prozessende vor Send, nach Commit/vor Reply und bei beschädigter Sicherung;
   echte neue Instanz, gleiche Identitäten und unveränderte Prosa.
2. `prepareNextVisit`, `storage/session.ts` und vorhandener Planpublisher:
   Timelineeintrag, Vorlesetext und Quellenbindung gemeinsam bestätigen oder den
   bestätigten Teil samt unverändertem ursprünglichen Folgeauftrag wiederaufnehmen.
   Ein erneuter Klick nach Fehler darf keinen zweiten Besuch als Ersatz erzeugen.
   Nicht aus zwei Einzelreceipts eine atomare Nutzeraktion ableiten. Abnahme:
   ungültige/gelöschte Quelle, verlorene Antwort des zweiten Commands, später
   geänderter Plan und Wiederaufnahme ohne Doppelanlage oder Textverlust.
3. `storage/campaign-data.ts` und Backupvalidierung: neue dauerhafte
   Anlage-/Folgeaufträge müssen vor Einführung einen dokumentierten Umgang bei
   Backup, Restore und unabhängiger Kopie besitzen. Historische Texte bleiben
   Originalbytes; offene Aufträge werden nicht automatisch in der Kopie ausgeführt.
   Bestehende Draft- und Kampagnenformate dürfen nicht still umgedeutet werden.

## Nächste ausführbare Abschlüsse

1. `plan-replacement.ts`, `session.ts`, `npc-world.ts`, `mask-health.ts`:
   fortentwickelte Worldgruppen mit Schaden, Zuständen und mehrfachen
   Besuchsreferenzen prüfen, einschließlich Ersatz eines Plans aus sich selbst.
   Abnahme: bestehende Worldidentität/HP erhalten; geänderte Entwurfskopie
   unabhängig; Leeren, Fresh und vollständiger Campaignimport erzeugen keine
   weiteren NPCs und verlieren keine Übernahmehistorie.
2. `plan-replacement.ts`, `progression.ts`, `campaign-data.ts`: bereits
   allokierte/verkaufte Beute und korrigierte Gutschriften kombinieren. Vorbereitete
   Rewards bleiben unabhängig; wirksame historische Fakten werden nicht erneut
   ausgeführt. Abnahme: Ersatz, Retry, Kopie und Fresh mit tatsächlichen
   Ledger-/Receiptzeilen und effektiven Beständen vergleichen; native
   Rewardinteraktion und Undo/Redo gesondert prüfen.
3. `session-ui.ts` und persistente Vorbereitung: offenen Profil-/Besuchs-/Gruppen-
   und Rewardtext vor Ersatz sichern; Preview unter ursprünglichem Context und
   Basis bestätigen. Geänderte Vorlage/Zielbasis verwirft die Vorschau ohne
   Datenänderung. Unklarer Commitausgang wird per Status geklärt. Abnahme:
   Eingabe während verzögerter Antwort, Contextwechsel, Savefehler und Fresh.

Die vorhandene Replacement-Basis bleibt der konkrete Anschluss. Diese Schritte
brauchen keine zweite Timelinearchitektur oder generische Historyabstraktion.
